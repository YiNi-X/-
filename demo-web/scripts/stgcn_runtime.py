from __future__ import annotations

import math

import numpy as np
import torch
import torch.nn as nn
import torch.nn.functional as F
import torch.nn.init as init


def scaled_laplacian(adjacency: np.ndarray) -> np.ndarray:
    degree = np.sum(adjacency, axis=1)
    laplacian = np.diag(degree) - adjacency

    for row_index in range(adjacency.shape[0]):
        for column_index in range(adjacency.shape[1]):
            if degree[row_index] > 0 and degree[column_index] > 0:
                laplacian[row_index, column_index] /= math.sqrt(degree[row_index] * degree[column_index])

    lambda_max = np.linalg.eigvals(laplacian).max().real
    return 2 * laplacian / lambda_max - np.eye(adjacency.shape[0])


def cheb_poly(laplacian: np.ndarray, order: int) -> np.ndarray:
    polynomials = [np.eye(laplacian.shape[0]), laplacian.copy()]
    for _ in range(2, order):
        polynomials.append(np.matmul(2 * laplacian, polynomials[-1]) - polynomials[-2])
    return np.asarray(polynomials)


class Align(nn.Module):
    def __init__(self, channels_in: int, channels_out: int) -> None:
        super().__init__()
        self.channels_in = channels_in
        self.channels_out = channels_out
        if channels_in > channels_out:
            self.conv1x1 = nn.Conv2d(channels_in, channels_out, 1)

    def forward(self, tensor: torch.Tensor) -> torch.Tensor:
        if self.channels_in > self.channels_out:
            return self.conv1x1(tensor)
        if self.channels_in < self.channels_out:
            return F.pad(tensor, [0, 0, 0, 0, 0, self.channels_out - self.channels_in, 0, 0])
        return tensor


class TemporalConvLayer(nn.Module):
    def __init__(self, kernel_size: int, channels_in: int, channels_out: int, activation: str = "relu") -> None:
        super().__init__()
        self.kernel_size = kernel_size
        self.channels_out = channels_out
        self.activation = activation
        self.align = Align(channels_in, channels_out)
        if activation == "GLU":
            self.conv = nn.Conv2d(channels_in, channels_out * 2, (kernel_size, 1), 1)
        else:
            self.conv = nn.Conv2d(channels_in, channels_out, (kernel_size, 1), 1)

    def forward(self, tensor: torch.Tensor) -> torch.Tensor:
        aligned = self.align(tensor)[:, :, self.kernel_size - 1 :, :]
        convolved = self.conv(tensor)
        if self.activation == "GLU":
            return (convolved[:, : self.channels_out, :, :] + aligned) * torch.sigmoid(convolved[:, self.channels_out :, :, :])
        if self.activation == "sigmoid":
            return torch.sigmoid(convolved + aligned)
        return torch.relu(convolved + aligned)


class SpatioConvLayer(nn.Module):
    def __init__(self, order: int, channels: int, chebyshev_tensor: torch.Tensor) -> None:
        super().__init__()
        self.Lk = chebyshev_tensor
        self.theta = nn.Parameter(torch.FloatTensor(channels, channels, order))
        self.b = nn.Parameter(torch.FloatTensor(1, channels, 1, 1))
        self.reset_parameters()

    def reset_parameters(self) -> None:
        init.kaiming_uniform_(self.theta, a=math.sqrt(5))
        fan_in, _ = init._calculate_fan_in_and_fan_out(self.theta)
        bound = 1 / math.sqrt(fan_in)
        init.uniform_(self.b, -bound, bound)

    def forward(self, tensor: torch.Tensor) -> torch.Tensor:
        chebyshev_x = torch.einsum("knm,bitm->bitkn", self.Lk, tensor)
        graph_conv = torch.einsum("iok,bitkn->botn", self.theta, chebyshev_x) + self.b
        return torch.relu(graph_conv + tensor)


class STConvBlock(nn.Module):
    def __init__(self, order: int, kernel_size: int, node_count: int, channels: list[int], dropout: float, chebyshev_tensor: torch.Tensor) -> None:
        super().__init__()
        self.tconv1 = TemporalConvLayer(kernel_size, channels[0], channels[1], "GLU")
        self.sconv = SpatioConvLayer(order, channels[1], chebyshev_tensor)
        self.tconv2 = TemporalConvLayer(kernel_size, channels[1], channels[2])
        self.ln = nn.LayerNorm([node_count, channels[2]])
        self.dropout = nn.Dropout(dropout)

    def forward(self, tensor: torch.Tensor) -> torch.Tensor:
        temporal_1 = self.tconv1(tensor)
        spatial = self.sconv(temporal_1)
        temporal_2 = self.tconv2(spatial)
        normalized = self.ln(temporal_2.permute(0, 2, 3, 1)).permute(0, 3, 1, 2)
        return self.dropout(normalized)


class FullyConvLayer(nn.Module):
    def __init__(self, channels: int) -> None:
        super().__init__()
        self.conv = nn.Conv2d(channels, 1, 1)

    def forward(self, tensor: torch.Tensor) -> torch.Tensor:
        return self.conv(tensor)


class OutputLayer(nn.Module):
    def __init__(self, channels: int, history_steps: int, node_count: int) -> None:
        super().__init__()
        self.tconv1 = TemporalConvLayer(history_steps, channels, channels, "GLU")
        self.ln = nn.LayerNorm([node_count, channels])
        self.tconv2 = TemporalConvLayer(1, channels, channels, "sigmoid")
        self.fc = FullyConvLayer(channels)

    def forward(self, tensor: torch.Tensor) -> torch.Tensor:
        temporal_1 = self.tconv1(tensor)
        normalized = self.ln(temporal_1.permute(0, 2, 3, 1)).permute(0, 3, 1, 2)
        temporal_2 = self.tconv2(normalized)
        return self.fc(temporal_2)


class STGCN(nn.Module):
    def __init__(
        self,
        order: int,
        kernel_size: int,
        blocks: list[list[int]],
        history_steps: int,
        node_count: int,
        chebyshev_tensor: torch.Tensor,
        dropout: float,
    ) -> None:
        super().__init__()
        self.st_conv1 = STConvBlock(order, kernel_size, node_count, blocks[0], dropout, chebyshev_tensor)
        self.st_conv2 = STConvBlock(order, kernel_size, node_count, blocks[1], dropout, chebyshev_tensor)
        self.output = OutputLayer(blocks[1][2], history_steps - 4 * (kernel_size - 1), node_count)

    def forward(self, tensor: torch.Tensor) -> torch.Tensor:
        tensor = self.st_conv1(tensor)
        tensor = self.st_conv2(tensor)
        return self.output(tensor)
