# -*- coding: utf-8 -*-
"""Genera la cotización formal en PDF para la herramienta de procesamiento de PDFs."""
from reportlab.lib.pagesizes import letter
from reportlab.lib.units import mm
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_RIGHT, TA_JUSTIFY
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, HRFlowable
)

AZUL = colors.HexColor("#1a3a5c")
GRIS = colors.HexColor("#555555")
GRIS_CLARO = colors.HexColor("#f2f4f7")

styles = getSampleStyleSheet()
styles.add(ParagraphStyle("Titulo", parent=styles["Title"], fontName="Helvetica-Bold",
                          fontSize=20, textColor=AZUL, spaceAfter=2))
styles.add(ParagraphStyle("Sub", parent=styles["Normal"], fontSize=9.5,
                          textColor=GRIS))
styles.add(ParagraphStyle("SubDer", parent=styles["Normal"], fontSize=9.5,
                          textColor=GRIS, alignment=TA_RIGHT))
styles.add(ParagraphStyle("Seccion", parent=styles["Heading2"], fontName="Helvetica-Bold",
                          fontSize=12, textColor=AZUL, spaceBefore=14, spaceAfter=6))
styles.add(ParagraphStyle("Cuerpo", parent=styles["Normal"], fontSize=10,
                          leading=14, alignment=TA_JUSTIFY))
styles.add(ParagraphStyle("Celda", parent=styles["Normal"], fontSize=9.5, leading=12))
styles.add(ParagraphStyle("CeldaBold", parent=styles["Normal"], fontSize=9.5,
                          leading=12, fontName="Helvetica-Bold"))
styles.add(ParagraphStyle("Nota", parent=styles["Normal"], fontSize=8.5,
                          leading=11.5, textColor=GRIS))

doc = SimpleDocTemplate(
    "Cotizacion_Herramienta_Procesamiento_PDF.pdf",
    pagesize=letter,
    leftMargin=20 * mm, rightMargin=20 * mm,
    topMargin=18 * mm, bottomMargin=18 * mm,
    title="Cotización - Herramienta de Procesamiento de PDFs",
    author="Mario - Boykot",
)

story = []

# ── Encabezado ────────────────────────────────────────────────
encabezado = Table(
    [[Paragraph("COTIZACIÓN", styles["Titulo"]),
      Paragraph("N° 2026-001<br/>Fecha: 07 de agosto de 2026<br/>Validez: 15 días",
                styles["SubDer"])]],
    colWidths=[100 * mm, 70 * mm],
)
encabezado.setStyle(TableStyle([
    ("VALIGN", (0, 0), (-1, -1), "TOP"),
    ("LEFTPADDING", (0, 0), (-1, -1), 0),
    ("RIGHTPADDING", (0, 0), (-1, -1), 0),
]))
story.append(encabezado)
story.append(Spacer(1, 2))
story.append(HRFlowable(width="100%", thickness=1.2, color=AZUL))
story.append(Spacer(1, 10))

datos = Table(
    [[Paragraph("<b>De:</b><br/>Mario<br/>mario@boykot.cl", styles["Sub"]),
      Paragraph("<b>Para:</b><br/>[Nombre del cliente]<br/>[Empresa / RUT]", styles["Sub"])]],
    colWidths=[85 * mm, 85 * mm],
)
datos.setStyle(TableStyle([
    ("VALIGN", (0, 0), (-1, -1), "TOP"),
    ("LEFTPADDING", (0, 0), (-1, -1), 0),
]))
story.append(datos)

# ── Descripción ───────────────────────────────────────────────
story.append(Paragraph("1. Descripción del proyecto", styles["Seccion"]))
story.append(Paragraph(
    "Desarrollo de una <b>herramienta de escritorio para Windows</b> que automatiza la "
    "lectura y el procesamiento de archivos PDF: escaneo automático de una carpeta de "
    "entrada, extracción de datos específicos de cada documento, procesamiento por lote "
    "y movimiento automático de los archivos ya procesados. Incluye una interfaz gráfica "
    "(CustomTkinter) con campos validados para el ingreso manual de requerimientos de "
    "auditoría, manejo de errores para evitar cierres inesperados, y entrega final como "
    "ejecutable independiente (.exe) que no requiere conocimientos técnicos para su uso.",
    styles["Cuerpo"]))

# ── Alcance ───────────────────────────────────────────────────
story.append(Paragraph("2. Alcance y valorización", styles["Seccion"]))

def celda(texto, bold=False):
    return Paragraph(texto, styles["CeldaBold" if bold else "Celda"])

filas = [
    [celda("Etapa", True), celda("Detalle", True), celda("Horas", True), celda("Valor", True)],
    [celda("1. Preparación del entorno"),
     celda("Instalación de Python 3.12+, Visual Studio Code y estructura de carpetas "
           "(/Entrada, /Procesados). <b>A cargo del cliente</b>, con 1 hora de "
           "acompañamiento remoto incluida."),
     celda("1"), celda("Incluido")],
    [celda("2. Motor lógico"),
     celda("Librerías de lectura de PDF (pdfplumber / PyPDF2), script de escaneo "
           "automático, procesamiento por lote y algoritmo de extracción de datos "
           "específicos con movimiento automático de archivos procesados."),
     celda("14"), celda("$280.000")],
    [celda("3. Interfaz gráfica y blindaje"),
     celda("Ventana visual en CustomTkinter, casillas gráficas (texto y menú "
           "desplegable) para requerimientos de auditoría, filtros de validación de "
           "datos y manejo de errores (Try/Except) ante fallas de lectura."),
     celda("9"), celda("$180.000")],
    [celda("4. Cierre y distribución"),
     celda("Pruebas de integración con archivos PDF reales del cliente, ajustes, y "
           "compilación a ejecutable Windows (.exe) mediante PyInstaller."),
     celda("6"), celda("$120.000")],
    [celda("Gestión y soporte"),
     celda("Reuniones de levantamiento y entrega, documentación de uso y soporte "
           "post-entrega durante 2 semanas."),
     celda("3"), celda("$60.000")],
]
tabla = Table(filas, colWidths=[38 * mm, 92 * mm, 14 * mm, 26 * mm], repeatRows=1)
tabla.setStyle(TableStyle([
    ("BACKGROUND", (0, 0), (-1, 0), AZUL),
    ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
    ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
    ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, GRIS_CLARO]),
    ("GRID", (0, 0), (-1, -1), 0.4, colors.HexColor("#c9d2dc")),
    ("VALIGN", (0, 0), (-1, -1), "TOP"),
    ("ALIGN", (2, 0), (3, -1), "RIGHT"),
    ("TOPPADDING", (0, 0), (-1, -1), 5),
    ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
]))
story.append(tabla)
story.append(Spacer(1, 6))

total = Table(
    [[celda("TOTAL (33 horas)", True), celda("<b>$640.000 CLP</b>", True)]],
    colWidths=[144 * mm, 26 * mm],
)
total.setStyle(TableStyle([
    ("BACKGROUND", (0, 0), (-1, -1), AZUL),
    ("TEXTCOLOR", (0, 0), (-1, -1), colors.white),
    ("ALIGN", (1, 0), (1, 0), "RIGHT"),
    ("TOPPADDING", (0, 0), (-1, -1), 6),
    ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
]))
story.append(total)
story.append(Spacer(1, 2))
story.append(Paragraph(
    "Valor por servicios profesionales emitido mediante boleta de honorarios "
    "(retención según normativa vigente).", styles["Nota"]))

# ── Supuestos ─────────────────────────────────────────────────
story.append(Paragraph("3. Supuestos del precio", styles["Seccion"]))
for s in [
    "Los PDF a procesar contienen <b>texto seleccionable</b> (no imágenes escaneadas) y "
    "mantienen un <b>formato consistente</b> entre sí. El procesamiento de documentos "
    "escaneados (OCR) o de múltiples formatos distintos se cotiza por separado.",
    "Antes de iniciar, el cliente entregará <b>3 a 5 archivos PDF de muestra</b> "
    "representativos, junto con la definición exacta de los campos a extraer y el "
    "destino de los datos (planilla, archivo de texto u otro).",
    "El precio incluye <b>2 rondas de ajustes</b> posteriores a la entrega. "
    "Modificaciones que amplíen el alcance se cotizan por separado.",
]:
    story.append(Paragraph("•&nbsp;&nbsp;" + s, styles["Cuerpo"]))
    story.append(Spacer(1, 4))

# ── Condiciones ───────────────────────────────────────────────
story.append(Paragraph("4. Plazo y forma de pago", styles["Seccion"]))
for s in [
    "<b>Plazo de entrega:</b> 2 a 3 semanas desde la recepción de los PDF de muestra y "
    "el anticipo.",
    "<b>Forma de pago:</b> 50% al inicio ($320.000) y 50% contra entrega del ejecutable "
    "probado ($320.000).",
    "<b>Entregables:</b> ejecutable Windows (.exe), código fuente comentado y guía breve "
    "de uso.",
]:
    story.append(Paragraph("•&nbsp;&nbsp;" + s, styles["Cuerpo"]))
    story.append(Spacer(1, 4))

story.append(Spacer(1, 14))
story.append(HRFlowable(width="100%", thickness=0.8, color=colors.HexColor("#c9d2dc")))
story.append(Spacer(1, 6))
story.append(Paragraph(
    "Cualquier consulta sobre esta cotización puede dirigirse a mario@boykot.cl. "
    "Quedamos atentos a su confirmación para agendar el inicio del proyecto.",
    styles["Nota"]))

doc.build(story)
print("OK")
