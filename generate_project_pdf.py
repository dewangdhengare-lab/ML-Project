import os
import sys
from reportlab.lib.pagesizes import letter
from reportlab.lib import colors
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak, KeepTogether, HRFlowable
)
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.pdfgen import canvas

class NumberedCanvas(canvas.Canvas):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self._saved_page_states = []

    def showPage(self):
        self._saved_page_states.append(dict(self.__dict__))
        self._startPage()

    def save(self):
        num_pages = len(self._saved_page_states)
        for state in self._saved_page_states:
            self.__dict__.update(state)
            self.draw_page_number(num_pages)
            canvas.Canvas.showPage(self)
        canvas.Canvas.save(self)

    def draw_page_number(self, page_count):
        self.saveState()
        self.setFont("Helvetica", 9)
        self.setFillColor(colors.HexColor("#718096"))
        
        # Header (pages > 1)
        if self._pageNumber > 1:
            self.drawString(54, 750, "AI-Based Human Activity Recognition Platform — Project Report")
            self.setStrokeColor(colors.HexColor("#E2E8F0"))
            self.setLineWidth(0.5)
            self.line(54, 742, 558, 742)
            
        # Footer
        page_text = f"Page {self._pageNumber} of {page_count}"
        self.drawRightString(558, 40, page_text)
        self.drawString(54, 40, "Confidential — Academic & Technical Evaluation Document")
        self.setStrokeColor(colors.HexColor("#E2E8F0"))
        self.setLineWidth(0.5)
        self.line(54, 52, 558, 52)
        self.restoreState()

def build_pdf():
    pdf_filename = r"d:\ML_project\HAR_Project_Comprehensive_Report.pdf"
    doc = SimpleDocTemplate(
        pdf_filename,
        pagesize=letter,
        leftMargin=54,
        rightMargin=54,
        topMargin=54,
        bottomMargin=54
    )

    styles = getSampleStyleSheet()
    
    # Custom Palette
    c_primary = colors.HexColor("#1A365D")    # Deep Navy
    c_secondary = colors.HexColor("#2B6CB0")  # Slate Blue
    c_dark = colors.HexColor("#2D3748")       # Body text
    c_light = colors.HexColor("#F7FAFC")      # Table background
    c_accent = colors.HexColor("#DD6B20")     # Highlight Orange
    c_teal = colors.HexColor("#319795")

    # Typography styles
    styles.add(ParagraphStyle(
        name='DocTitle',
        fontName='Helvetica-Bold',
        fontSize=24,
        leading=28,
        textColor=c_primary,
        alignment=1, # Center
        spaceAfter=10
    ))
    styles.add(ParagraphStyle(
        name='DocSubtitle',
        fontName='Helvetica',
        fontSize=12,
        leading=16,
        textColor=c_secondary,
        alignment=1,
        spaceAfter=25
    ))
    styles.add(ParagraphStyle(
        name='SectionHeading',
        fontName='Helvetica-Bold',
        fontSize=16,
        leading=20,
        textColor=c_primary,
        spaceBefore=14,
        spaceAfter=8,
        keepWithNext=True
    ))
    styles.add(ParagraphStyle(
        name='SubSectionHeading',
        fontName='Helvetica-Bold',
        fontSize=12,
        leading=16,
        textColor=c_secondary,
        spaceBefore=10,
        spaceAfter=4,
        keepWithNext=True
    ))
    styles.add(ParagraphStyle(
        name='ReportBody',
        fontName='Helvetica',
        fontSize=10,
        leading=14,
        textColor=c_dark,
        spaceAfter=6
    ))
    styles.add(ParagraphStyle(
        name='ReportBullet',
        fontName='Helvetica',
        fontSize=10,
        leading=14,
        textColor=c_dark,
        leftIndent=15,
        spaceAfter=4
    ))
    styles.add(ParagraphStyle(
        name='CalloutText',
        fontName='Helvetica-Oblique',
        fontSize=10,
        leading=14,
        textColor=colors.HexColor("#2C5282")
    ))
    styles.add(ParagraphStyle(
        name='TableHead',
        fontName='Helvetica-Bold',
        fontSize=9,
        leading=11,
        textColor=colors.white,
        alignment=0
    ))
    styles.add(ParagraphStyle(
        name='TableCell',
        fontName='Helvetica',
        fontSize=8.5,
        leading=11,
        textColor=c_dark
    ))
    styles.add(ParagraphStyle(
        name='TableRoleCell',
        fontName='Helvetica-Bold',
        fontSize=9,
        leading=12,
        textColor=c_primary
    ))

    story = []

    # Title & Header
    story.append(Paragraph("AI-BASED HUMAN ACTIVITY RECOGNITION PLATFORM", styles['DocTitle']))
    story.append(Paragraph("Comprehensive Technical Specification, Architecture & Team Role Breakdown<br/><b>Execution Mode:</b> 100% Localhost • <b>Hardware Target:</b> NVIDIA GeForce RTX 3050 (6GB VRAM)", styles['DocSubtitle']))
    story.append(HRFlowable(width="100%", thickness=1.5, color=c_secondary, spaceBefore=0, spaceAfter=15))

    # SECTION 1: EXECUTIVE SUMMARY & PROBLEM STATEMENT
    story.append(Paragraph("1. Executive Summary & Problem Statement", styles['SectionHeading']))
    story.append(Paragraph(
        "<b>Project Mission:</b> To develop a local, privacy-first, web-accessible deep learning platform that allows non-technical users to ingest custom action datasets, automatically inspect and validate video streams using OpenCV, train genuine 3D Convolutional Neural Networks (R3D-18) using hardware-accelerated GPU resources, and run automated, real-time activity predictions on newly captured footage.",
        styles['ReportBody']
    ))
    story.append(Paragraph("<b>The Core Problem: Photos vs. Motion (Why 2D Computer Vision Fails)</b>", styles['SubSectionHeading']))
    story.append(Paragraph(
        "Standard computer vision models are built for 2D static images (Height × Width). However, human activities (such as walking, running, falling, punching, or stretching) are fundamentally defined by <i>temporal movement across time</i>. A static photo of a raised arm cannot determine whether an individual is waving goodbye, stretching, or throwing a punch. 3D Spatiotemporal modeling processes sequential frames across time simultaneously to extract velocity, trajectory, cadence, and limb displacement.",
        styles['ReportBody']
    ))
    story.append(Paragraph("<b>Limitations in Existing Industry Solutions:</b>", styles['SubSectionHeading']))
    story.append(Paragraph("• <b>Cloud & Privacy Dilemma:</b> Commercial platforms (AWS Rekognition, Google Cloud Vertex AI) require uploading sensitive surveillance video over the internet, violating HIPAA medical privacy and enterprise data security protocols.", styles['ReportBullet']))
    story.append(Paragraph("• <b>Complexity & Tooling Barrier:</b> Academic research repositories (MMAction2, PyTorchVideo) require terminal proficiency, manual format conversion scripts, and complex Docker configs beyond the reach of healthcare or security staff.", styles['ReportBullet']))
    story.append(Paragraph("• <b>Hardware Overload:</b> Most video transformers demand massive enterprise GPUs (A100/H100 with 40–80GB VRAM) and immediately crash with Out-Of-Memory (OOM) errors on consumer hardware.", styles['ReportBullet']))

    story.append(Spacer(1, 10))

    # SECTION 2: SYSTEM ARCHITECTURE & TECH STACK
    story.append(Paragraph("2. System Architecture & Technical Stack", styles['SectionHeading']))
    story.append(Paragraph(
        "The application utilizes a completely decoupled Client-Server architecture running locally without external web service dependencies:",
        styles['ReportBody']
    ))

    tech_data = [
        [Paragraph("Layer", styles['TableHead']), Paragraph("Technology", styles['TableHead']), Paragraph("Architectural Justification", styles['TableHead'])],
        [Paragraph("Frontend UI", styles['TableRoleCell']), Paragraph("React 18 + TypeScript + Vite", styles['TableCell']), Paragraph("Modern reactive Single-Page Application (SPA) with strict type safety, modular routing, and sub-second Hot Module Replacement.", styles['TableCell'])],
        [Paragraph("Styling & UX", styles['TableRoleCell']), Paragraph("Tailwind CSS + Lucide Icons", styles['TableCell']), Paragraph("Responsive dark-theme cyberpunk interface, accessibility badges, upload modals, and telemetry gauges.", styles['TableCell'])],
        [Paragraph("Live Charting", styles['TableRoleCell']), Paragraph("Recharts Library", styles['TableCell']), Paragraph("Dynamic real-time loss and accuracy curves updated via polling without requiring full browser reloads.", styles['TableCell'])],
        [Paragraph("Backend REST API", styles['TableRoleCell']), Paragraph("FastAPI (Python 3.13) + Uvicorn", styles['TableCell']), Paragraph("Asynchronous ASGI server hosted on port 8001 providing high-concurrency request handling and auto-generated Swagger UI.", styles['TableCell'])],
        [Paragraph("Database & ORM", styles['TableRoleCell']), Paragraph("SQLite + SQLAlchemy 2.0", styles['TableCell']), Paragraph("Zero-config persistent single-file database (`har_platform.db`) with dual async (`aiosqlite`) and synchronous engines.", styles['TableCell'])],
        [Paragraph("Video Processing", styles['TableRoleCell']), Paragraph("OpenCV (`cv2`)", styles['TableCell']), Paragraph("Direct frame decoding, container integrity inspection, aspect-ratio resizing, and SHA-256 duplicate hashing.", styles['TableCell'])],
        [Paragraph("Deep Learning", styles['TableRoleCell']), Paragraph("PyTorch 2.14 + Torchvision", styles['TableCell']), Paragraph("R3D-18 backbone, Kinetics-400 pretrained transfer weights, autograd backpropagation, and Cross-Entropy loss.", styles['TableCell'])],
        [Paragraph("GPU Acceleration", styles['TableRoleCell']), Paragraph("NVIDIA CUDA 12.6 + AMP", styles['TableCell']), Paragraph("Targeted for RTX 3050 (6GB). PyTorch Automatic Mixed Precision (FP16) cuts VRAM usage by 50% and doubles throughput.", styles['TableCell'])],
        [Paragraph("Async Worker", styles['TableRoleCell']), Paragraph("Python `threading` + Queue", styles['TableCell']), Paragraph("Background daemon thread decoupled from FastAPI's event loop to prevent web server freezes during long multi-hour training runs.", styles['TableCell'])],
    ]
    t_tech = Table(tech_data, colWidths=[90, 140, 274])
    t_tech.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), c_primary),
        ('ALIGN', (0,0), (-1,-1), 'LEFT'),
        ('VALIGN', (0,0), (-1,-1), 'TOP'),
        ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor("#CBD5E0")),
        ('ROWBACKGROUNDS', (0,1), (-1,-1), [colors.white, c_light]),
        ('TOPPADDING', (0,0), (-1,-1), 4),
        ('BOTTOMPADDING', (0,0), (-1,-1), 4),
    ]))
    story.append(t_tech)

    story.append(PageBreak())

    # SECTION 3: TEAM MEMBERS & RESPONSIBILITY DISTRIBUTION
    story.append(Paragraph("3. Team Roles & Work Distribution (3 Members)", styles['SectionHeading']))
    story.append(Paragraph(
        "To ensure balanced contributions, the project was cleanly divided into three distinct architectural layers: Frontend/UI, Backend/Data Pipeline, and Machine Learning/GPU Acceleration.",
        styles['ReportBody']
    ))

    # MEMBER 1
    story.append(Paragraph("Member 1: Frontend Engineer & UI/UX Lead", styles['SubSectionHeading']))
    m1_box = [
        [Paragraph("<b>Primary Ownership:</b> Web Interface, Real-Time Charting, Client-Side Routing & UX Validation", styles['CalloutText'])],
        [Paragraph("• <b>Architecture & Tooling:</b> Built the React 18 SPA in TypeScript with Vite bundler, styling all screens with Tailwind CSS.<br/>"
                   "• <b>5 Core Pages Developed:</b><br/>"
                   "  1. <i>Dashboard:</i> Real-time GPU telemetry card (RTX 3050 status, memory) and global summary counters.<br/>"
                   "  2. <i>Dataset Management:</i> Drag-and-drop ZIP uploaders, multi-file video selectors, and class distribution charts.<br/>"
                   "  3. <i>Training Center:</i> Visual hyperparameter configuration forms (epochs, batch size, learning rates, train/val/test sliders).<br/>"
                   "  4. <i>Model Registry:</i> Visual catalog of saved `.pth` checkpoints with benchmark metrics and class mappings.<br/>"
                   "  5. <i>Analysis Module:</i> Video upload panel with top action label, confidence meter, and millisecond latency timers.<br/>"
                   "• <b>Real-Time Visualizations:</b> Integrated Recharts for live rendering of Loss vs. Epoch and Accuracy vs. Epoch trajectories.<br/>"
                   "• <b>Client Error Handling:</b> Designed Axios interceptors to intercept backend validation errors and format them into readable alerts.", styles['ReportBody'])]
    ]
    t_m1 = Table(m1_box, colWidths=[504])
    t_m1.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), colors.HexColor("#EBF8FF")),
        ('BOX', (0,0), (-1,-1), 1, colors.HexColor("#3182CE")),
        ('LEFTPADDING', (0,0), (-1,-1), 8),
        ('RIGHTPADDING', (0,0), (-1,-1), 8),
        ('TOPPADDING', (0,0), (-1,-1), 6),
        ('BOTTOMPADDING', (0,0), (-1,-1), 6),
    ]))
    story.append(t_m1)
    story.append(Spacer(1, 10))

    # MEMBER 2
    story.append(Paragraph("Member 2: Backend & System Pipeline Engineer", styles['SubSectionHeading']))
    m2_box = [
        [Paragraph("<b>Primary Ownership:</b> REST API Engine, SQLite Database Modeling & OpenCV Video Validation Engine", styles['CalloutText'])],
        [Paragraph("• <b>FastAPI REST Architecture:</b> Developed all API routes (`/datasets`, `/training`, `/models`, `/analysis`, `/system`) on port 8001.<br/>"
                   "• <b>Database Schema Design:</b> Built relational models in SQLAlchemy 2.0 with cascading delete relationships (`ON DELETE CASCADE`) to prevent foreign-key orphaned records when datasets are removed.<br/>"
                   "• <b>OpenCV Validation Pipeline (`video_service.py`):</b><br/>"
                   "  - Opens every incoming video with `cv2.VideoCapture` to verify codec decodability and flag corrupt containers.<br/>"
                   "  - Extracts video properties: spatial resolution, total frame count, FPS, and duration.<br/>"
                   "  - Implemented <b>SHA-256 Cryptographic Hashing</b> to detect identical duplicate clips and prevent test-set data leakage.<br/>"
                   "• <b>Ingestion Security:</b> Implemented safe archive extraction protecting against Zip-Bomb exploits, scaling capacity up to 20 GB and 100,000 files for massive datasets like Real-Life Violence.", styles['ReportBody'])]
    ]
    t_m2 = Table(m2_box, colWidths=[504])
    t_m2.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), colors.HexColor("#F0FFF4")),
        ('BOX', (0,0), (-1,-1), 1, colors.HexColor("#38A169")),
        ('LEFTPADDING', (0,0), (-1,-1), 8),
        ('RIGHTPADDING', (0,0), (-1,-1), 8),
        ('TOPPADDING', (0,0), (-1,-1), 6),
        ('BOTTOMPADDING', (0,0), (-1,-1), 6),
    ]))
    story.append(t_m2)
    story.append(Spacer(1, 10))

    # MEMBER 3
    story.append(Paragraph("Member 3: Machine Learning & Computer Vision Lead", styles['SubSectionHeading']))
    m3_box = [
        [Paragraph("<b>Primary Ownership:</b> 3D CNN Modeling (R3D-18), Spatiotemporal Tensors, GPU Optimization & Training Worker", styles['CalloutText'])],
        [Paragraph("• <b>Spatiotemporal Deep Learning Model:</b> Implemented <b>R3D-18 (3D ResNet-18)</b> in PyTorch. Unlike 2D CNNs, R3D-18 employs 3D convolution kernels ($K_t × K_h × K_w$) sliding across space and consecutive time frames simultaneously.<br/>"
                   "• <b>Transfer Learning:</b> Leveraged Kinetics-400 pretrained weights, severing the final linear head and attaching custom classifier layers for user-specific activity categories.<br/>"
                   "• <b>Tensor Construction:</b> Engineered sampling transforms extracting uniform 16-frame sequences resized to 112×112, producing standardized 5D PyTorch tensors shaped `[Batch, 3, 16, 112, 112]`.<br/>"
                   "• <b>Dual-Format Support:</b> Extended loader to seamlessly ingest both raw video clips (`.mp4`, `.avi`) and sequential image-frame directories (`.jpg`, `.png`).<br/>"
                   "• <b>NVIDIA RTX 3050 (6GB) Optimization:</b> Implemented <b>PyTorch Automatic Mixed Precision (AMP / FP16)</b>, reducing VRAM footprint by 50% to prevent CUDA Out-of-Memory crashes.<br/>"
                   "• <b>Background Training Thread:</b> Built a multi-threaded daemon worker (`training_worker.py`) using thread-safe queues and SQLite sync sessions, ensuring training never freezes the FastAPI web server.", styles['ReportBody'])]
    ]
    t_m3 = Table(m3_box, colWidths=[504])
    t_m3.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), colors.HexColor("#FAF5FF")),
        ('BOX', (0,0), (-1,-1), 1, colors.HexColor("#805AD5")),
        ('LEFTPADDING', (0,0), (-1,-1), 8),
        ('RIGHTPADDING', (0,0), (-1,-1), 8),
        ('TOPPADDING', (0,0), (-1,-1), 6),
        ('BOTTOMPADDING', (0,0), (-1,-1), 6),
    ]))
    story.append(t_m3)

    story.append(PageBreak())

    # SECTION 4: DEEP LEARNING PRINCIPLES & MATH
    story.append(Paragraph("4. Deep Learning Methodology & Mathematical Formulations", styles['SectionHeading']))
    story.append(Paragraph(
        "<b>1. 2D vs. 3D Convolutional Mathematics:</b><br/>"
        "In standard 2D Convolution, feature values at position $(x, y)$ are calculated over spatial kernel dimensions $P$ and $Q$:<br/>"
        "&nbsp;&nbsp;&nbsp;&nbsp;<b>v<sub>ij</sub><sup>xy</sup> = f( &Sigma;<sub>m</sub> &Sigma;<sub>p</sub> &Sigma;<sub>q</sub> w<sub>ijm</sub><sup>pq</sup> v<sub>(i-1)m</sub><sup>(x+p)(y+q)</sup> + b<sub>ij</sub> )</b><br/><br/>"
        "In our <b>3D ResNet (R3D-18)</b>, an additional temporal dimension <i>r</i> across kernel temporal length $R$ is introduced:<br/>"
        "&nbsp;&nbsp;&nbsp;&nbsp;<b>v<sub>ij</sub><sup>xyz</sup> = f( &Sigma;<sub>m</sub> &Sigma;<sub>p</sub> &Sigma;<sub>q</sub> &Sigma;<sub>r</sub> w<sub>ijm</sub><sup>pqr</sup> v<sub>(i-1)m</sub><sup>(x+p)(y+q)(z+r)</sup> + b<sub>ij</sub> )</b><br/>"
        "This formulation allows the network to mathematically capture feature displacement and velocity vectors across consecutive video frames.",
        styles['ReportBody']
    ))
    story.append(Paragraph(
        "<b>2. ResNet Residual Skip Connections:</b><br/>"
        "To prevent the vanishing gradient problem in deep networks, residual blocks compute:<br/>"
        "&nbsp;&nbsp;&nbsp;&nbsp;<b>y = F(x, {W<sub>i</sub>}) + x</b><br/>"
        "where <i>x</i> and <i>y</i> are the input and output vectors, and <i>F</i> is the residual mapping to be learned. The identity shortcut ensures error gradients flow directly back to early layers without degrading.",
        styles['ReportBody']
    ))
    story.append(Paragraph(
        "<b>3. Loss Function & Softmax Classification:</b><br/>"
        "Model parameters are optimized by minimizing <b>Categorical Cross-Entropy Loss</b>:<br/>"
        "&nbsp;&nbsp;&nbsp;&nbsp;<b>L<sub>CE</sub> = &minus; &Sigma;<sub>c=1</sub><sup>C</sup> y<sub>c</sub> log( &ycirc;<sub>c</sub> )</b><br/>"
        "where raw logits <i>z<sub>i</sub></i> are converted to probability distributions via the Softmax function:<br/>"
        "&nbsp;&nbsp;&nbsp;&nbsp;<b>&ycirc;<sub>i</sub> = exp(z<sub>i</sub>) / &Sigma;<sub>j=1</sub><sup>C</sup> exp(z<sub>j</sub>)</b>",
        styles['ReportBody']
    ))

    story.append(Spacer(1, 10))

    # SECTION 5: REAL-LIFE USE CASES & FUTURE SCOPE
    story.append(Paragraph("5. Real-World Applications & Future Scope", styles['SectionHeading']))
    
    apps_data = [
        [Paragraph("Domain", styles['TableHead']), Paragraph("Problem Solved", styles['TableHead']), Paragraph("Deployment Impact", styles['TableHead'])],
        [Paragraph("Healthcare & Elderly Care", styles['TableRoleCell']), Paragraph("Sudden accidental patient falls in unmonitored rooms.", styles['TableCell']), Paragraph("Instant alert to nursing stations within 100ms; 100% on-premise privacy with zero cloud video transmission.", styles['TableCell'])],
        [Paragraph("Public Safety & Security", styles['TableRoleCell']), Paragraph("Operator fatigue monitoring dozens of live CCTV cameras.", styles['TableCell']), Paragraph("Automated violence, assault, and fight detection flagging security feeds with high-confidence alarms.", styles['TableCell'])],
        [Paragraph("Industrial Safety", styles['TableRoleCell']), Paragraph("OSHA violations: workers entering hazardous machinery zones or unsafe ladder climbing.", styles['TableCell']), Paragraph("Automated machine shut-off triggers and compliance incident logging.", styles['TableCell'])],
        [Paragraph("Sports & Physical Therapy", styles['TableRoleCell']), Paragraph("Manual exercise form evaluation and repetition counting.", styles['TableCell']), Paragraph("Algorithmic athletic technique analysis and improper form warnings.", styles['TableCell'])],
    ]
    t_apps = Table(apps_data, colWidths=[100, 180, 224])
    t_apps.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), c_primary),
        ('VALIGN', (0,0), (-1,-1), 'TOP'),
        ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor("#CBD5E0")),
        ('ROWBACKGROUNDS', (0,1), (-1,-1), [colors.white, c_light]),
        ('TOPPADDING', (0,0), (-1,-1), 4),
        ('BOTTOMPADDING', (0,0), (-1,-1), 4),
    ]))
    story.append(t_apps)
    story.append(Spacer(1, 10))

    story.append(Paragraph("<b>Planned Future Roadmap:</b>", styles['SubSectionHeading']))
    story.append(Paragraph("1. <b>Live RTSP CCTV Streaming:</b> Implementing circular rolling frame buffers to analyze live IP camera feeds 24/7 without manual video uploads.", styles['ReportBullet']))
    story.append(Paragraph("2. <b>Multi-Person Tracking:</b> Coupling YOLOv8 object detection and MediaPipe Pose estimation to classify multiple individuals simultaneously in a single frame.", styles['ReportBullet']))
    story.append(Paragraph("3. <b>Edge AI Quantization:</b> Converting PyTorch `.pth` models to INT8 TensorRT engines for deployment onto $200 NVIDIA Jetson micro-computers embedded directly inside camera enclosures.", styles['ReportBullet']))

    story.append(Spacer(1, 15))

    # SECTION 6: SUMMARY TABLE FOR ACADEMIC EVALUATION
    story.append(Paragraph("6. Project Verification & Readiness Summary", styles['SectionHeading']))
    summary_data = [
        [Paragraph("Metric / Feature", styles['TableHead']), Paragraph("Status", styles['TableHead']), Paragraph("Verification Detail", styles['TableHead'])],
        [Paragraph("Frontend Codebase", styles['TableCell']), Paragraph("PASSED", styles['TableCell']), Paragraph("Zero TypeScript errors; production bundle built via Vite.", styles['TableCell'])],
        [Paragraph("Backend API Routing", styles['TableCell']), Paragraph("PASSED", styles['TableCell']), Paragraph("FastAPI operational on port 8001; full Swagger docs available.", styles['TableCell'])],
        [Paragraph("OpenCV Verification", styles['TableCell']), Paragraph("PASSED", styles['TableCell']), Paragraph("Corrupt file handling, FPS, duration, and SHA-256 duplicate checks verified.", styles['TableCell'])],
        [Paragraph("GPU Acceleration", styles['TableCell']), Paragraph("PASSED", styles['TableCell']), Paragraph("NVIDIA GeForce RTX 3050 (6GB) recognized via CUDA 12.6 + FP16 AMP.", styles['TableCell'])],
        [Paragraph("Data Ingestion", styles['TableCell']), Paragraph("PASSED", styles['TableCell']), Paragraph("Scaled to 20 GB / 100,000 files; supports both video and image sequences.", styles['TableCell'])],
        [Paragraph("Execution Model", styles['TableCell']), Paragraph("100% LOCAL", styles['TableCell']), Paragraph("Zero cloud dependency; complete data confidentiality guaranteed.", styles['TableCell'])],
    ]
    t_summary = Table(summary_data, colWidths=[130, 80, 294])
    t_summary.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), c_secondary),
        ('VALIGN', (0,0), (-1,-1), 'TOP'),
        ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor("#CBD5E0")),
        ('ROWBACKGROUNDS', (0,1), (-1,-1), [colors.white, c_light]),
        ('TOPPADDING', (0,0), (-1,-1), 4),
        ('BOTTOMPADDING', (0,0), (-1,-1), 4),
    ]))
    story.append(t_summary)

    # Build Document
    doc.build(story, canvasmaker=NumberedCanvas)
    print(f"Successfully generated PDF: {pdf_filename}")

if __name__ == "__main__":
    build_pdf()
