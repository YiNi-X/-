from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_JUSTIFY
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import cm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import (
    PageBreak,
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)


ROOT = Path(r"C:\Users\X\Desktop\服务外包网站设计")
OUTPUT = ROOT / "AI协同流程说明文档.pdf"
FONT_PATH = Path(r"C:\Windows\Fonts\simhei.ttf")

FONT_NAME = "SimHeiCustom"
pdfmetrics.registerFont(TTFont(FONT_NAME, str(FONT_PATH)))

styles = getSampleStyleSheet()
styles.add(
    ParagraphStyle(
        name="DocTitle",
        parent=styles["Title"],
        fontName=FONT_NAME,
        fontSize=24,
        leading=34,
        textColor=colors.HexColor("#0f172a"),
        alignment=TA_CENTER,
        spaceAfter=14,
    )
)
styles.add(
    ParagraphStyle(
        name="Kicker",
        parent=styles["Normal"],
        fontName=FONT_NAME,
        fontSize=14,
        leading=20,
        alignment=TA_CENTER,
        textColor=colors.HexColor("#113a67"),
        spaceAfter=18,
    )
)
styles.add(
    ParagraphStyle(
        name="Meta",
        parent=styles["Normal"],
        fontName=FONT_NAME,
        fontSize=11,
        leading=18,
        alignment=TA_CENTER,
        textColor=colors.HexColor("#4b5563"),
        spaceAfter=4,
    )
)
styles.add(
    ParagraphStyle(
        name="SectionHeading",
        parent=styles["Heading1"],
        fontName=FONT_NAME,
        fontSize=16,
        leading=24,
        textColor=colors.HexColor("#102c4d"),
        spaceBefore=10,
        spaceAfter=8,
    )
)
styles.add(
    ParagraphStyle(
        name="SubHeading",
        parent=styles["Heading2"],
        fontName=FONT_NAME,
        fontSize=13,
        leading=20,
        textColor=colors.HexColor("#173b64"),
        spaceBefore=8,
        spaceAfter=6,
    )
)
styles.add(
    ParagraphStyle(
        name="BodyCN",
        parent=styles["BodyText"],
        fontName=FONT_NAME,
        fontSize=11,
        leading=19,
        alignment=TA_JUSTIFY,
        textColor=colors.HexColor("#1f2937"),
        spaceAfter=6,
    )
)
styles.add(
    ParagraphStyle(
        name="LeadBox",
        parent=styles["BodyText"],
        fontName=FONT_NAME,
        fontSize=11,
        leading=19,
        textColor=colors.HexColor("#1f2937"),
        backColor=colors.HexColor("#e8f0fb"),
        borderColor=colors.HexColor("#c8d9ef"),
        borderWidth=1,
        borderPadding=8,
        spaceAfter=8,
    )
)
styles.add(
    ParagraphStyle(
        name="BlockTitle",
        parent=styles["BodyText"],
        fontName=FONT_NAME,
        fontSize=11,
        leading=18,
        textColor=colors.HexColor("#102c4d"),
        spaceAfter=3,
    )
)
styles.add(
    ParagraphStyle(
        name="SmallNote",
        parent=styles["BodyText"],
        fontName=FONT_NAME,
        fontSize=10,
        leading=16,
        textColor=colors.HexColor("#4b5563"),
        backColor=colors.HexColor("#eef3f8"),
        borderColor=colors.HexColor("#d5e0ec"),
        borderPadding=8,
        leftIndent=0,
        spaceBefore=4,
        spaceAfter=8,
    )
)


def p(text: str, style: str = "BodyCN") -> Paragraph:
    return Paragraph(text, styles[style])


def bullet(text: str) -> Paragraph:
    return Paragraph(f"• {text}", styles["BodyCN"])


def make_table(rows, col_widths):
    table = Table(rows, colWidths=col_widths, repeatRows=1)
    table.setStyle(
        TableStyle(
            [
                ("FONTNAME", (0, 0), (-1, -1), FONT_NAME),
                ("FONTSIZE", (0, 0), (-1, -1), 9.6),
                ("LEADING", (0, 0), (-1, -1), 13),
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#edf3fa")),
                ("TEXTCOLOR", (0, 0), (-1, 0), colors.HexColor("#102c4d")),
                ("GRID", (0, 0), (-1, -1), 0.6, colors.HexColor("#cfd8e3")),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("LEFTPADDING", (0, 0), (-1, -1), 6),
                ("RIGHTPADDING", (0, 0), (-1, -1), 6),
                ("TOPPADDING", (0, 0), (-1, -1), 6),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
            ]
        )
    )
    return table


def draw_page(canvas, doc):
    canvas.saveState()
    width, height = A4
    canvas.setStrokeColor(colors.HexColor("#b9c4d0"))
    canvas.setDash(2, 2)
    canvas.line(2.5 * cm, 2 * cm, 2.5 * cm, height - 2 * cm)
    canvas.setDash()
    canvas.setFont(FONT_NAME, 9)
    canvas.setFillColor(colors.HexColor("#6b7280"))
    canvas.drawRightString(width - 2 * cm, 1.2 * cm, f"第 {doc.page} 页")
    canvas.restoreState()


story = []

# Cover
story.extend(
    [
        Spacer(1, 5.2 * cm),
        Paragraph("提交材料二", styles["Kicker"]),
        Paragraph("AI 协同流程说明文档", styles["DocTitle"]),
        Paragraph("项目名称：港口智慧管理平台（珠江口船舶交通状态识别与协同决策演示版）", styles["Meta"]),
        Paragraph("文档用途：说明项目在设计、开发、测试、部署与更新等环节中使用 AI 工具/平台/技术的方式，以及对应解决的真实问题。", styles["Meta"]),
        Spacer(1, 0.8 * cm),
    ]
)

cover_rows = [
    [p("<b>项目成果形态</b>", "BodyCN"), p("单页大屏网站 Demo，基于静态卫星底图、主航路轨迹、热点网格、时间片回放、协同建议与收益对比进行演示。")],
    [p("<b>主要技术栈</b>", "BodyCN"), p("Vite + React + TypeScript + CSS + SVG 动画 + Vercel 持续部署。")],
    [p("<b>主要 AI 协同工具</b>", "BodyCN"), p("GPT-5/Codex 类 AI 编码助手、多模态图片理解能力、自然语言需求整理能力、AI 辅助前端设计与调试能力。")],
    [p("<b>研究内容依据</b>", "BodyCN"), p("轨迹修复、主航路识别/聚类、网格化流量预测等论文材料与代码依据；演示层采用预置时间片与场景化推演结果。")],
]
story.append(make_table([[p("字段", "BodyCN"), p("说明", "BodyCN")]] + cover_rows, [4.2 * cm, 9.8 * cm]))
story.append(PageBreak())

# Section 1
story.append(Paragraph("一、项目概述", styles["SectionHeading"]))
story.append(
    Paragraph(
        "本项目围绕珠江口研究区的船舶交通监测与预测问题展开，将论文与代码中的研究成果转化为可视化演示平台。平台以“现在发生了什么、接下来会怎样、系统建议怎么做、做完能带来什么改善”为叙事主线，面向答辩和场景展示进行实现。",
        styles["LeadBox"],
    )
)
story.append(
    p(
        "项目内容既包含业务层面的 AI 模型成果展示，也包含开发过程中的人机协同。前者主要体现为轨迹修复、主航路识别与流量预测；后者主要体现为使用 AI 工具辅助需求澄清、界面设计、前端编码、调试修复、部署上线和交付材料撰写。整个过程坚持“人工定目标、AI 提方案、人工测试确认、再进入下一步”的协同原则。"
    )
)

# Section 2
story.append(Paragraph("二、项目中实际使用的 AI 技术基础", styles["SectionHeading"]))
table1_rows = [
    [p("类别"), p("具体技术 / 平台"), p("在项目中的作用")],
    [p("业务 AI 模型"), p("ATT-BiLSTM、BiLSTM、LSTM、STGCN-C"), p("对应论文中的轨迹修复与时空流量预测技术，是本次平台演示中“主航路与流量预测结果”的内容依据。")],
    [p("业务数据处理方法"), p("轨迹聚类、RDP 压缩、改进距离度量、自适应 DBSCAN、网格化处理"), p("用于主航路识别、轨迹压缩、热点区域归纳和研究区空间离散化，是地图航路和热点展示的重要依据。")],
    [p("开发协同 AI 平台"), p("GPT-5/Codex 类 AI 编码助手"), p("辅助完成需求分析、设计方案拆解、页面结构重构、代码编写、样式优化、问题定位、部署配置和说明文档撰写。")],
    [p("多模态 AI 能力"), p("图片理解与界面对照分析"), p("对参考图、卫星图、聚类图、区块截图进行比对，帮助完成航线位置、热点位置和界面视觉风格的贴近式优化。")],
]
story.append(make_table(table1_rows, [3.1 * cm, 4.4 * cm, 6.5 * cm]))

# Section 3
story.append(Paragraph("三、AI 协同流程说明", styles["SectionHeading"]))

story.append(Paragraph("（一）需求理解与方案收敛阶段", styles["SubHeading"]))
story.append(
    p(
        "在项目开始阶段，首先面临的问题不是“怎么写代码”，而是“论文成果应该以什么样的网页形式展现”。项目资料同时包含论文文档、实验截图、笔记本代码、静态卫星底图和参考界面图片，信息来源多且口径不完全一致，直接开发会造成界面叙事混乱。"
    )
)
story.append(
    p(
        "这一阶段主要使用了 GPT-5/Codex 类 AI 编码助手的自然语言整理能力和多模态理解能力。具体做法包括：阅读论文与代码依据，归纳项目技术主线；识别“当前仓库真正完整落地的是轨迹修复、轨迹聚类和流量预测”这一事实；据此将网站第一版定位成“场景化演示版”，而不是伪装成真实部署系统。"
    )
)
story.append(Paragraph("AI 在本阶段解决的真实问题：", styles["BlockTitle"]))
story.extend(
    [
        bullet("将分散的论文、代码、图片资料收敛成统一叙事主线，避免页面内容与研究成果脱节。"),
        bullet("帮助快速判断哪些内容来自当前代码主线，哪些属于论文扩展叙事，降低答辩时被追问“代码是否真实实现”的风险。"),
        bullet("将模糊需求压缩为可执行页面结构，例如单屏大屏、5 个时间片、静态卫星底图、右侧建议与收益对比等。"),
    ]
)

story.append(Paragraph("（二）设计阶段", styles["SubHeading"]))
story.append(
    p(
        "在设计阶段，AI 主要承担“从学术成果到可视化产品”的翻译工作。项目需要把论文中的轨迹修复、聚类、网格化、流量预测与热点分析，转成评委一眼能理解的大屏界面。AI 在这一阶段辅助生成了页面线框结构、模块命名、示例数据、信息优先级和 90 秒讲解顺序。"
    )
)
story.append(
    p(
        "设计过程中还使用了 AI 的图片理解能力，对用户提供的设备大屏参考图、卫星地图和聚类结果图进行比对，逐步将页面风格从普通 Dashboard 收紧成“港口监测控制台”的视觉语言，并将地图放在底层、功能模块覆盖四周，实现“打开即见全部模块、无需滚轮下拉”的单屏展示目标。"
    )
)
story.append(Paragraph("本阶段使用的 AI 工具/技术：", styles["BlockTitle"]))
story.extend(
    [
        bullet("自然语言方案生成：用于快速形成单屏大屏结构、模块清单、示例数据与演讲顺序。"),
        bullet("多模态参考图理解：用于对照设备大屏风格、调整布局密度、减少“AI 味”与模板化感。"),
        bullet("前端设计辅助：用于统一标题、状态标签、面板层级、色彩与组件风格。"),
    ]
)
story.append(Paragraph("AI 在本阶段解决的真实问题：", styles["BlockTitle"]))
story.extend(
    [
        bullet("显著缩短从“论文技术内容”到“网页展示方案”的转化时间。"),
        bullet("帮助在极短工期内完成多轮视觉迭代，避免人工从零做大量线框草图。"),
        bullet("让页面更贴合答辩场景，突出评委真正关心的“看见问题、预测趋势、给出建议、体现收益”。"),
    ]
)

story.append(Paragraph("（三）开发阶段", styles["SubHeading"]))
story.append(
    p(
        "在开发阶段，AI 的作用最为直接。项目基于 Vite + React + TypeScript 构建前端工程，AI 协助完成了项目初始化、单页大屏结构编码、状态数据组织、SVG 航线生成、热点区域动画、时间轴回放、协同建议面板、收益对比面板等功能模块的实现。"
    )
)
story.append(
    p(
        "由于项目工期紧、后端并未真实接入，开发阶段采用了“预置时间片 + 静态场景数据 + 自动回放”的实现策略。AI 根据用户确认的剧情，把 5 个时间片数据组织为可维护的结构，并进一步加上“应用方案前/后”的双状态叙事，最终形成协同决策演示闭环。"
    )
)
story.append(Paragraph("本阶段使用的 AI 工具/技术：", styles["BlockTitle"]))
story.extend(
    [
        bullet("AI 辅助代码生成：快速搭建 React 组件结构、状态管理、样式框架和按钮交互逻辑。"),
        bullet("AI 辅助代码重构：将页面从普通数据看板逐步重构为更接近监控平台的单屏控制台。"),
        bullet("AI 辅助可视化生成：根据聚类图与卫星图信息，生成主航路线条、船舶动画和热点区域表现。"),
        bullet("AI 辅助调试工具开发：为航线和热点位置校正单独制作可视化调试台，提高空间对位效率。"),
    ]
)
story.append(Paragraph("AI 在本阶段解决的真实问题：", styles["BlockTitle"]))
story.extend(
    [
        bullet("在无后端、无真实 GIS 系统接入的情况下，快速构建“看起来像活系统”的演示页面。"),
        bullet("显著降低前端页面重构成本，能够反复根据老师/用户反馈调整布局而不需要大面积重写。"),
        bullet("帮助实现复杂但轻量的动画表达，例如航线流动、热点消散、方案应用后的状态变化。"),
    ]
)

story.append(Paragraph("（四）测试与调优阶段", styles["SubHeading"]))
story.append(
    p(
        "测试阶段主要采用“AI 协助定位问题 + 人工视觉确认”的方式推进。由于项目是可视化网站，很多问题不是传统逻辑错误，而是比例错位、元素重叠、地图与航线坐标不一致、热区位置失真、滚动条影响观感、按钮状态与画面变化不同步等界面问题。"
    )
)
story.append(
    p(
        "AI 在这一阶段能够快速检查代码结构、发现样式冲突、解释错误根因，并给出针对性的修复方案。例如：定位地图覆盖层高度异常导致航线不可见的问题；发现主站与调试台使用了不同显示参考系，造成轨迹与底图错位；重构右上策略卡和右侧建议区，解决文字重叠；调整热区消散动画与热点网格数同步问题等。"
    )
)
story.append(Paragraph("本阶段使用的 AI 工具/技术：", styles["BlockTitle"]))
story.extend(
    [
        bullet("AI 辅助代码审查与定位：快速判断问题来自结构、状态、样式还是坐标系。"),
        bullet("AI 辅助构建验证：结合 lint、build 等命令反复校验页面是否可正常发布。"),
        bullet("AI 辅助交互调优：根据用户反馈不断修正船舶大小、热区颜色、滚动条样式、建议卡高度等细节。"),
    ]
)
story.append(Paragraph("AI 在本阶段解决的真实问题：", styles["BlockTitle"]))
story.extend(
    [
        bullet("将大量原本需要肉眼试错的前端问题缩短为“定位原因—提出修法—本地验证”的闭环。"),
        bullet("减少因布局冲突、坐标不一致、状态不同步导致的答辩风险。"),
        bullet("保证页面在快速迭代中仍能保持可构建、可运行、可展示。"),
    ]
)

story.append(Paragraph("（五）部署与运营更新阶段", styles["SubHeading"]))
story.append(
    p(
        "项目最终需要快速上线，方便在不同设备和不同地点进行演示，因此部署阶段采用了 GitHub + Vercel 的方式。AI 协助完成了 Vercel/Netlify 配置文件生成、本地预览命令整理、项目与 Vercel 的绑定说明、以及后续“代码修改后如何自动重新部署”的更新流程说明。"
    )
)
story.append(
    p(
        "在运营更新阶段，AI 的价值主要体现为：当用户继续修改航线、热区、建议文案、动效节奏或布局细节时，可以在本地快速改动并重新构建验证，再通过 Git 推送触发线上自动部署，显著降低维护门槛。"
    )
)
story.append(Paragraph("本阶段使用的 AI 工具/技术：", styles["BlockTitle"]))
story.extend(
    [
        bullet("AI 辅助部署配置：生成 Vercel 与 Netlify 所需配置文件和操作说明。"),
        bullet("AI 辅助发布验证：检查打包结果、确认入口页与调试页是否都被纳入构建。"),
        bullet("AI 辅助运维文档：梳理后续更新、推送、自动部署的标准流程。"),
    ]
)
story.append(Paragraph("AI 在本阶段解决的真实问题：", styles["BlockTitle"]))
story.extend(
    [
        bullet("帮助项目在极短时间内从“本地页面”变成“可分享、可远程演示的在线网站”。"),
        bullet("降低后续更新门槛，使非专业前端开发者也能完成小幅维护和内容调整。"),
        bullet("保证网站版本迭代路径清晰，便于演示前的最后冲刺修改。"),
    ]
)

# Section 4
story.append(Paragraph("四、AI 协同方式带来的实际成效", styles["SectionHeading"]))
table2_rows = [
    [p("环节"), p("若无 AI 协助的主要难点"), p("AI 介入后的改进"), p("对真实场景的价值")],
    [p("方案收敛"), p("论文、代码、图片和展示需求之间存在口径差异，人工梳理耗时长。"), p("快速归纳核心主线，明确页面只做单屏、单剧情、单按钮闭环。"), p("保证演示内容与研究成果一致，降低答辩时解释成本。")],
    [p("界面设计"), p("很难在短时间内把学术成果转成高可信的大屏视觉。"), p("快速得到线框、模块命名、配色方向和信息优先级。"), p("提高页面专业感，使评委更快理解系统用途。")],
    [p("前端开发"), p("组件、状态、动画和地图叠加开发量大，纯手工实现周期长。"), p("高效完成单页大屏、热点动画、建议面板、收益对比等功能。"), p("在有限工期内做出完整可演示系统原型。")],
    [p("测试调优"), p("前端视觉问题难定位，容易靠反复试错。"), p("快速解释错位、重叠、比例失真、状态不同步等问题根因。"), p("减少界面事故，提高演示稳定性。")],
    [p("部署更新"), p("首次上线和后续更新流程不清晰，容易在临近答辩时出错。"), p("快速形成自动部署链路和更新方法。"), p("支持远程访问与多轮修改，提高交付效率。")],
]
story.append(make_table(table2_rows, [2.2 * cm, 4.0 * cm, 4.2 * cm, 4.1 * cm]))

# Section 5
story.append(Paragraph("五、AI 协同过程中的人工把关与风险控制", styles["SectionHeading"]))
story.append(
    p(
        "虽然本项目广泛使用了 AI 工具辅助推进，但所有关键决策均由人工确认后执行，具体包括：页面定位是否符合论文口径、轨迹和热点位置是否符合实际截图、建议文案是否会引发技术真实性追问、页面改动是否通过人工视觉验收、以及代码是否允许提交和部署等。"
    )
)
story.append(
    p(
        "在具体执行中，项目采用“AI 生成方案—人工确认方向—AI 实现代码—人工打开页面测试—确认通过后再进入下一步”的协作机制。这样既充分利用了 AI 的速度优势，也避免了 AI 直接替代人工判断带来的失真风险。"
    )
)
story.append(
    Paragraph(
        "说明：协同管控建议与收益对比在本项目中采用的是“基于研究成果的场景化策略推演”口径，而不是宣称已构建完整实时联控后端。该表述既能够体现项目价值，也保证了答辩材料的真实性与严谨性。",
        styles["SmallNote"],
    )
)

# Section 6
story.append(Paragraph("六、结论", styles["SectionHeading"]))
story.append(
    p(
        "本项目的 AI 协同并不是简单地“让 AI 写代码”，而是贯穿了资料理解、方案收敛、界面设计、前端实现、测试调优、部署上线和文档交付的完整流程。AI 在项目中承担了高效率的信息整理者、方案生成者、编码助手、调试助手和部署助手等多重角色，而人工则负责目标定义、结果筛选、页面验收和真实性把关。"
    )
)
story.append(
    p(
        "实践表明，在工期紧、资料多、演示要求高的场景下，合理使用 AI 协同工具能够显著提升项目推进效率，帮助团队将论文研究成果更快转化为可展示、可交流、可迭代的数字化产品原型。对于本项目而言，AI 协同不仅缩短了开发周期，也直接提升了展示质量和交付完整度。"
    )
)
story.append(Spacer(1, 0.4 * cm))
story.append(
    Paragraph(
        "本文档为《港口智慧管理平台》项目 AI 协同流程说明材料，可用于提交、归档和答辩辅助说明。",
        styles["Meta"],
    )
)


doc = SimpleDocTemplate(
    str(OUTPUT),
    pagesize=A4,
    leftMargin=3 * cm,
    rightMargin=2 * cm,
    topMargin=2 * cm,
    bottomMargin=2 * cm,
    title="AI协同流程说明文档",
    author="Codex",
)

doc.build(story, onFirstPage=draw_page, onLaterPages=draw_page)
print(OUTPUT)
