import type { RepairViewPoint } from './repairTypes.ts'

type RepairTrajectoryPlotProps = {
  missing: RepairViewPoint[]
  groundTruth: RepairViewPoint[]
  repair: RepairViewPoint[]
  showMissing: boolean
  showGroundTruth: boolean
  showRepair: boolean
  selectedModelLabel: string
}

function toPath(points: RepairViewPoint[]) {
  if (!points.length) return ''
  return points
    .map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x.toFixed(2)} ${point.y.toFixed(2)}`)
    .join(' ')
}

function endPoint(points: RepairViewPoint[]) {
  return points[points.length - 1] ?? null
}

export function RepairTrajectoryPlot({ missing, groundTruth, repair, showMissing, showGroundTruth, showRepair, selectedModelLabel }: RepairTrajectoryPlotProps) {
  const width = 100
  const height = 100
  const missingEnd = endPoint(missing)
  const groundTruthEnd = endPoint(groundTruth)
  const repairEnd = endPoint(repair)

  return (
    <div className="repair-trajectory-shell">
      <div className="repair-trajectory-caption">
        <div>
          <span>主可视化</span>
          <strong>缺失、真实与修复轨迹叠加图</strong>
        </div>
        <div className="repair-trajectory-legend">
          {showMissing ? <span className="legend-missing">缺失 / 噪声</span> : null}
          {showGroundTruth ? <span className="legend-ground">真实轨迹</span> : null}
          {showRepair ? <span className="legend-repair">{selectedModelLabel}</span> : null}
        </div>
      </div>

      <div className="repair-trajectory-canvas">
        <svg viewBox={`0 0 ${width} ${height}`} className="repair-trajectory-svg" role="img" aria-label="轨迹修复对比图">
          {[20, 40, 60, 80].map((line) => (
            <g key={line}>
              <line x1="0" y1={String(line)} x2={String(width)} y2={String(line)} className="repair-grid-line" />
              <line x1={String(line)} y1="0" x2={String(line)} y2={String(height)} className="repair-grid-line" />
            </g>
          ))}

          {showGroundTruth ? <path d={toPath(groundTruth)} className="repair-line repair-line-ground" /> : null}
          {showMissing ? <path d={toPath(missing)} className="repair-line repair-line-missing" /> : null}
          {showRepair ? <path d={toPath(repair)} className="repair-line repair-line-selected" /> : null}

          {showGroundTruth && groundTruthEnd ? <circle cx={groundTruthEnd.x} cy={groundTruthEnd.y} r="1.6" className="repair-point-ground" /> : null}
          {showMissing && missingEnd ? <circle cx={missingEnd.x} cy={missingEnd.y} r="1.6" className="repair-point-missing" /> : null}
          {showRepair && repairEnd ? <circle cx={repairEnd.x} cy={repairEnd.y} r="1.8" className="repair-point-selected" /> : null}
        </svg>
      </div>
    </div>
  )
}
