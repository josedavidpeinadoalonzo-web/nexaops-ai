const { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, WidthType, AlignmentType, HeadingLevel } = require('docx');
const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');

// Crear directorio de salida
const outputDir = path.join(__dirname, 'documentos');
if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir);

// ===================== MEMORIA DESCRIPTIVA (WORD) =====================
const doc = new Document({
    sections: [{
        properties: {},
        children: [
            new Paragraph({
                children: [
                    new TextRun({ text: "MEMORIA DESCRIPTIVA", bold: true, size: 48 })
                ],
                alignment: AlignmentType.CENTER,
                spacing: { after: 400 }
            }),
            new Paragraph({
                children: [
                    new TextRun({ text: "Laboratorio de Producción de Productos Cosméticos" })
                ],
                alignment: AlignmentType.CENTER,
                spacing: { after: 200 }
            }),
            new Paragraph({
                children: [
                    new TextRun({ text: "Jenny Lizarazo" })
                ],
                alignment: AlignmentType.CENTER,
                spacing: { after: 400 }
            }),
            new Paragraph({
                children: [new TextRun({ text: "1. INFORMACIÓN GENERAL", bold: true })],
                heading: HeadingLevel.HEADING_1
            }),
            new Table({
                width: { size: 100, type: WidthType.PERCENTAGE },
                rows: [
                    new TableRow({ children: [new TableCell({ children: [new Paragraph("Campo")], fill: "CCCCCC" }), new TableCell({ children: [new Paragraph("Detalle")], fill: "CCCCCC" })] }),
                    new TableRow({ children: [new TableCell({ children: [new Paragraph("Nombre del Proyecto")] }), new TableCell({ children: [new Paragraph("Laboratorio Cosméticos Jenny Lizarazo")] })] }),
                    new TableRow({ children: [new TableCell({ children: [new Paragraph("Propietaria")] }), new TableCell({ children: [new Paragraph("Jenny Lizarazo")] })] }),
                    new TableRow({ children: [new TableCell({ children: [new Paragraph("Ubicación")] }), new TableCell({ children: [new Paragraph("Medellín, Antioquia, Colombia")] })] }),
                    new TableRow({ children: [new TableCell({ children: [new Paragraph("Área Construcción")] }), new TableCell({ children: [new Paragraph("8.00 m x 12.00 m = 96.00 m² por nivel")] })] }),
                    new TableRow({ children: [new TableCell({ children: [new Paragraph("Niveles")] }), new TableCell({ children: [new Paragraph("2 pisos")] })] }),
                    new TableRow({ children: [new TableCell({ children: [new Paragraph("Área Total Construida")] }), new TableCell({ children: [new Paragraph("192.00 m²")] })] }),
                    new TableRow({ children: [new TableCell({ children: [new Paragraph("Uso")] }), new TableCell({ children: [new Paragraph("Laboratorio de producción cosmética")] })] }),
                    new TableRow({ children: [new TableCell({ children: [new Paragraph("Norma Applicable")] }), new TableCell({ children: [new Paragraph("BPM - Buenas Prácticas de Manufactura")] })] }),
                ]
            }),
            new Paragraph({ children: [new TextRun({ text: "2. DESCRIPCIÓN ARQUITECTÓNICA", bold: true })], heading: HeadingLevel.HEADING_1 }),
            new Paragraph({ children: [new TextRun({ text: "Primer Piso (Área Producción - 96 m²)", bold: true })] }),
            new Paragraph({ children: [new TextRun({ text: "• Área de Pesaje: 12.00 m²" })] }),
            new Paragraph({ children: [new TextRun({ text: "• Zona de Almacenamiento: 15.00 m²" })] }),
            new Paragraph({ children: [new TextRun({ text: "• Área de Producción: 35.00 m²" })] }),
            new Paragraph({ children: [new TextRun({ text: "• Área de Envasado: 12.00 m²" })] }),
            new Paragraph({ children: [new TextRun({ text: "• Zona de Circulación: 22.00 m²" })] }),
            new Paragraph({ children: [new TextRun({ text: "Segundo Piso (Área Administrativa - 96 m²)", bold: true })] }),
            new Paragraph({ children: [new TextRun({ text: "• Oficina Principal: 18.00 m²" })] }),
            new Paragraph({ children: [new TextRun({ text: "• Laboratorio Control Calidad: 20.00 m²" })] }),
            new Paragraph({ children: [new TextRun({ text: "• Baños y Vestidores: 12.00 m²" })] }),
            new Paragraph({ children: [new TextRun({ text: "• Sala de Reuniones: 15.00 m²" })] }),
            new Paragraph({ children: [new TextRun({ text: "3. NORMATIVIDAD APLICADA", bold: true })], heading: HeadingLevel.HEADING_1 }),
            new Paragraph({ children: [new TextRun({ text: "• NSR-10 - Reglamento Colombiano de Construcción Sismo Resistente" })] }),
            new Paragraph({ children: [new TextRun({ text: "• INVIMA - Buenas Prácticas de Manufactura (Resolución 2674)" })] }),
            new Paragraph({ children: [new TextRun({ text: "• ISO 22716:2007 - Buenas Prácticas de Manufactura para Cosméticos" })] }),
            new Paragraph({ children: [new TextRun({ text: "• RETIE - Reglamento Técnico de Instalaciones Eléctricas" })] }),
            new Paragraph({ children: [new TextRun({ text: "4. SISTEMA ESTRUCTURAL", bold: true })], heading: HeadingLevel.HEADING_1 }),
            new Paragraph({ children: [new TextRun({ text: "Tipo: Pórticos de concreto reforzado" })] }),
            new Paragraph({ children: [new TextRun({ text: "• Columnas: Concreto f'c = 21 MPa" })] }),
            new Paragraph({ children: [new TextRun({ text: "• Vigas: Concreto f'c = 21 MPa" })] }),
            new Paragraph({ children: [new TextRun({ text: "• Losa entrepiso: Viguetas y bovedilla H = 0.25 m" })] }),
            new Paragraph({ children: [new TextRun({ text: "• Cubierta: Estructura metálica con techo deck" })] }),
            new Paragraph({ children: [new TextRun({ text: "5. PRESUPUESTO ESTIMADO", bold: true })], heading: HeadingLevel.HEADING_1 }),
            new Paragraph({ children: [new TextRun({ text: "Valor total del proyecto: $308,297,000 COP" })] }),
            new Paragraph({ children: [new TextRun({ text: "Duración estimada: 10 meses (41 semanas)" })] }),
        ]
    }]
});

Packer.toBuffer(doc).then(buffer => {
    fs.writeFileSync(path.join(outputDir, 'Memoria_Descriptiva.docx'), buffer);
    console.log('✓ Memoria_Descriptiva.docx creado');
});

// ===================== CÁLCULOS ESTRUCTURALES (EXCEL) =====================
const calcData = [
    ['CÁLCULOS ESTRUCTURALES - Laboratorio Cosméticos Jenny Lizarazo', '', '', '', ''],
    ['Medellín, Antioquia - Colombia', '', '', '', ''],
    ['', '', '', '', ''],
    ['1. CARGAS DE DISEÑO', '', '', '', ''],
    ['Carga Muerta (D)', '', '', '', ''],
    ['Elemento', 'Descripción', 'Unidad', 'Carga (kg/m²)', ''],
    ['Losa entrepiso', 'Viguetas y bovedilla', 'm²', '300', ''],
    ['Acabados de piso', '', 'm²', '100', ''],
    ['Cielo raso + instalaciones', '', 'm²', '50', ''],
    ['Muro exterior (bloque 15cm)', '', 'm²', '220', ''],
    ['Mampostería interna', '', 'm²', '150', ''],
    ['Total carga muerta', '', '', '820', ''],
    ['', '', '', '', ''],
    ['Carga Viva (L)', '', '', '', ''],
    ['Elemento', 'Descripción', 'Unidad', 'Carga (kg/m²)', ''],
    ['Entrepiso (oficinas)', '', 'm²', '250', ''],
    ['Cubierta', '', 'm²', '100', ''],
    ['', '', '', '', ''],
    ['2. DISEÑO DE LA LOSA', '', '', '', ''],
    ['Parámetro', 'Valor', 'Unidad', '', ''],
    ['Luz libre', '4.00', 'm', '', ''],
    ['Tipo', 'Viguetas prefabricadas', '', '', ''],
    ['Altura total', '0.25', 'm', '', ''],
    ['Separación entre viguetas', '0.625', 'm', '', ''],
    ['', '', '', '', ''],
    ['3. DISEÑO DE VIGAS', '', '', '', ''],
    ['Parámetro', 'Valor', 'Unidad', '', ''],
    ['Dimensiones', '24 x 40', 'cm', '', ''],
    ['Momento último', '4,500', 'kg·m', '', ''],
    ['Acero principal', '3φ 1/2"', '', '', ''],
    ['Estribos', 'φ 3/8" @ 15cm', '', '', ''],
    ['', '', '', '', ''],
    ['4. DISEÑO DE COLUMNAS', '', '', '', ''],
    ['Parámetro', 'Valor', 'Unidad', '', ''],
    ['Dimensiones', '30 x 30', 'cm', '', ''],
    ['Acero longitudinal', '6φ 1/2"', '', '', ''],
    ['Estribos', 'φ 3/8" @ 15cm', '', '', ''],
    ['Cuantía', '0.85', '%', '', ''],
    ['', '', '', '', ''],
    ['5. DISEÑO DE CIMENTACIÓN', '', '', '', ''],
    ['Parámetro', 'Valor', 'Unidad', '', ''],
    ['Tipo', 'Zapatas aisladas', '', '', ''],
    ['Capacidad portante', '15,000', 'kg/m²', '', ''],
    ['Profundidad', '1.50', 'm', '', ''],
    ['Dimensión Zapata Z1', '1.70 x 1.70', 'm', '', ''],
    ['Acero de refuerzo', 'φ 5/8" @ 20cm', '', '', ''],
    ['', '', '', '', ''],
    ['6. RESUMEN DE MATERIALES', '', '', '', ''],
    ['Material', 'Cantidad', 'Unidad', '', ''],
    ['Concreto f\'c=21 MPa', '85', 'm³', '', ''],
    ['Acero Fy=4200 MPa', '8,500', 'kg', '', ''],
    ['Viguetas', '192', 'unidades', '', ''],
    ['Bovedillas', '576', 'unidades', '', ''],
    ['Bloque No. 4', '4,500', 'unidades', '', ''],
];

const calcWorkbook = XLSX.utils.book_new();
const calcSheet = XLSX.utils.aoa_to_sheet(calcData);

// Anchos de columnas
calcSheet['!cols'] = [
    { wch: 30 }, { wch: 25 }, { wch: 15 }, { wch: 15 }, { wch: 15 }
];

XLSX.utils.book_append_sheet(calcWorkbook, calcSheet, 'Cálculos Estructurales');
XLSX.writeFile(calcWorkbook, path.join(outputDir, 'Calculos_Estructurales.xlsx'));
console.log('✓ Calculos_Estructurales.xlsx creado');

// ===================== PRESUPUESTO (EXCEL) =====================
const presupuestoData = [
    ['PRESUPUESTO - Laboratorio Cosméticos Jenny Lizarazo', '', '', '', '', ''],
    ['Medellín, Antioquia - Colombia', '', '', '', '', ''],
    ['Área Total: 192 m² | Duración: 10 meses', '', '', '', '', ''],
    ['', '', '', '', '', ''],
    ['1. PRELIMINARES Y CIMIENTACIÓN', '', '', '', '', ''],
    ['Ítem', 'Descripción', 'Und', 'Cant', 'P.U. (COP)', 'Total (COP)'],
    ['1.1', 'Limpieza del terreno', 'm²', '100', '8,000', '800,000'],
    ['1.2', 'Trazado y nivelación', 'm²', '100', '12,000', '1,200,000'],
    ['1.3', 'Excavación manual', 'm³', '120', '45,000', '5,400,000'],
    ['1.4', 'Relleno compactado', 'm³', '60', '35,000', '2,100,000'],
    ['1.5', 'Solado de limpieza', 'm²', '45', '25,000', '1,125,000'],
    ['1.6', 'Zapata de cimentación', 'm³', '18', '380,000', '6,840,000'],
    ['1.7', 'Vigas de amarre', 'm³', '8', '420,000', '3,360,000'],
    ['', '', '', '', 'Subtotal:', '20,825,000'],
    ['', '', '', '', '', ''],
    ['2. ESTRUCTURA', '', '', '', '', ''],
    ['2.1', 'Columnas concreto', 'm³', '12', '450,000', '5,400,000'],
    ['2.2', 'Vigas de entrepiso', 'm³', '15', '420,000', '6,300,000'],
    ['2.3', 'Losa vigueta y bovedilla', 'm²', '192', '85,000', '16,320,000'],
    ['2.4', 'Estructura de cubierta', 'm²', '100', '95,000', '9,500,000'],
    ['2.5', 'Cubierta techo deck', 'm²', '100', '85,000', '8,500,000'],
    ['', '', '', '', 'Subtotal:', '46,020,000'],
    ['', '', '', '', '', ''],
    ['3. MAMPOSTERÍA Y ACABADOS', '', '', '', '', ''],
    ['3.1', 'Muro bloque No.4', 'm²', '280', '55,000', '15,400,000'],
    ['3.2', 'Muro bloque No.2', 'm²', '120', '45,000', '5,400,000'],
    ['3.3', 'Pañete muros', 'm²', '400', '28,000', '11,200,000'],
    ['3.4', 'Estuco y pintura', 'm²', '400', '25,000', '10,000,000'],
    ['3.5', 'Pisos cerámica', 'm²', '192', '65,000', '12,480,000'],
    ['3.6', 'Puertas y ventanas', 'Gl', '1', '12,000,000', '12,000,000'],
    ['3.7', 'Divisiones baño', 'Und', '4', '850,000', '3,400,000'],
    ['3.8', 'Pintura epóxica zona producción', 'm²', '96', '45,000', '4,320,000'],
    ['', '', '', '', 'Subtotal:', '74,200,000'],
    ['', '', '', '', '', ''],
    ['4. INSTALACIONES ELÉCTRICAS', '', '', '', '', ''],
    ['4.1', 'Punto eléctrico', 'Und', '45', '85,000', '3,825,000'],
    ['4.2', 'Punto luz', 'Und', '35', '65,000', '2,275,000'],
    ['4.3', 'Tablero general', 'Und', '1', '1,200,000', '1,200,000'],
    ['4.4', 'Subtablero', 'Und', '2', '450,000', '900,000'],
    ['4.5', 'Tubería conduit', 'm', '350', '18,000', '6,300,000'],
    ['4.6', 'Cableado', 'm', '800', '12,000', '9,600,000'],
    ['4.7', 'Luminarias LED', 'Und', '40', '85,000', '3,400,000'],
    ['4.8', 'Sistema tierras', 'Gl', '1', '2,500,000', '2,500,000'],
    ['', '', '', '', 'Subtotal:', '30,000,000'],
    ['', '', '', '', '', ''],
    ['5. INSTALACIONES HIDRÁULICAS', '', '', '', '', ''],
    ['5.1', 'Tubería PVC 4"', 'm', '40', '35,000', '1,400,000'],
    ['5.2', 'Tubería PVC 2"', 'm', '60', '22,000', '1,320,000'],
    ['5.3', 'Tubería PVC 1"', 'm', '80', '15,000', '1,200,000'],
    ['5.4', 'Punto sanitario', 'Und', '8', '120,000', '960,000'],
    ['5.5', 'Punto agua', 'Und', '12', '95,000', '1,140,000'],
    ['5.6', 'Sanitarios', 'Und', '4', '850,000', '3,400,000'],
    ['5.7', 'Lavamanos', 'Und', '4', '450,000', '1,800,000'],
    ['5.8', 'Tanque elevado 2000L', 'Und', '1', '2,200,000', '2,200,000'],
    ['5.9', 'Bomba de agua', 'Und', '1', '1,800,000', '1,800,000'],
    ['', '', '', '', 'Subtotal:', '15,220,000'],
    ['', '', '', '', '', ''],
    ['6. AIRE ACONDICIONADO (BPM)', '', '', '', '', ''],
    ['6.1', 'Sistema Split Duct producción', 'Gl', '1', '18,000,000', '18,000,000'],
    ['6.2', 'Sistema independiente oficina', 'Und', '2', '4,500,000', '9,000,000'],
    ['6.3', 'Ductos galvanized', 'm', '80', '45,000', '3,600,000'],
    ['6.4', 'Rejillas y difusores', 'Und', '12', '280,000', '3,360,000'],
    ['6.5', 'Filtros HEPA', 'Und', '4', '850,000', '3,400,000'],
    ['6.6', 'Control de temperatura', 'Und', '3', '1,200,000', '3,600,000'],
    ['', '', '', '', 'Subtotal:', '40,960,000'],
    ['', '', '', '', '', ''],
    ['7. FACHADA MODERNA', '', '', '', '', ''],
    ['7.1', 'Panel aluminio compuesto', 'm²', '45', '180,000', '8,100,000'],
    ['7.2', 'Ventanería aluminio', 'm²', '25', '220,000', '5,500,000'],
    ['7.3', 'Vidrio reflectivo 6mm', 'm²', '25', '95,000', '2,375,000'],
    ['7.4', 'Iluminación LED fachada', 'm', '30', '85,000', '2,550,000'],
    ['7.5', 'Estructura soporte', 'Gl', '1', '4,500,000', '4,500,000'],
    ['7.6', 'Puerta automática', 'Und', '1', '3,500,000', '3,500,000'],
    ['7.7', 'Señalización', 'Gl', '1', '1,800,000', '1,800,000'],
    ['', '', '', '', 'Subtotal:', '28,325,000'],
    ['', '', '', '', '', ''],
    ['8. DISEÑO Y LICENCIAS', '', '', '', '', ''],
    ['8.1', 'Diseño arquitectónico', 'm²', '192', '35,000', '6,720,000'],
    ['8.2', 'Diseño estructural', 'Gl', '1', '4,500,000', '4,500,000'],
    ['8.3', 'Diseño eléctrico', 'Gl', '1', '2,200,000', '2,200,000'],
    ['8.4', 'Diseño hidráulico', 'Gl', '1', '1,800,000', '1,800,000'],
    ['8.5', 'Licencia construcción', 'Gl', '1', '3,500,000', '3,500,000'],
    ['8.6', 'Dirección técnica', 'Gl', '1', '6,000,000', '6,000,000'],
    ['', '', '', '', 'Subtotal:', '24,720,000'],
    ['', '', '', '', '', ''],
    ['', '', '', '', '', ''],
    ['', 'RESUMEN', '', '', '', ''],
    ['', 'Preliminares y cimentación', '', '', '', '20,825,000'],
    ['', 'Estructura', '', '', '', '46,020,000'],
    ['', 'Mampostería y acabados', '', '', '', '74,200,000'],
    ['', 'Instalaciones eléctricas', '', '', '', '30,000,000'],
    ['', 'Instalaciones hidráulicas', '', '', '', '15,220,000'],
    ['', 'Aire acondicionado', '', '', '', '40,960,000'],
    ['', 'Fachada moderna', '', '', '', '28,325,000'],
    ['', 'Diseño y licencias', '', '', '', '24,720,000'],
    ['', '', '', 'SUBTOTAL', '280,270,000'],
    ['', '', '', 'Imprevistos (10%)', '28,027,000'],
    ['', '', '', 'TOTAL', '308,297,000'],
];

const presupuestoWorkbook = XLSX.utils.book_new();
const presupuestoSheet = XLSX.utils.aoa_to_sheet(presupuestoData);

presupuestoSheet['!cols'] = [
    { wch: 8 }, { wch: 35 }, { wch: 8 }, { wch: 8 }, { wch: 15 }, { wch: 15 }
];

XLSX.utils.book_append_sheet(presupuestoWorkbook, presupuestoSheet, 'Presupuesto');
XLSX.writeFile(presupuestoWorkbook, path.join(outputDir, 'Presupuesto.xlsx'));
console.log('✓ Presupuesto.xlsx creado');

console.log('\n✓ Todos los documentos creados en:', outputDir);