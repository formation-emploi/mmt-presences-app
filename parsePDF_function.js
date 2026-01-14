// PDF Parser - Extract ALL fields from PDF
async function parsePDF(file) {
    try {
        const arrayBuffer = await file.arrayBuffer();
        const pdfDoc = await PDFLib.PDFDocument.load(arrayBuffer);
        const form = pdfDoc.getForm();

        // Extract ALL form fields
        const allFields = form.getFields();
        const pdfData = {};

        allFields.forEach(field => {
            const name = field.getName();
            try {
                if (field instanceof PDFLib.PDFTextField) {
                    pdfData[name] = field.getText() || '';
                } else if (field instanceof PDFLib.PDFCheckBox) {
                    pdfData[name] = field.isChecked();
                } else if (field instanceof PDFLib.PDFRadioGroup) {
                    pdfData[name] = field.getSelected() || '';
                }
            } catch (e) {
                console.warn(`Could not read field ${name}:`, e);
            }
        });

        console.log('📋 Champs PDF extraits:', Object.keys(pdfData).length);

        // Extract participant data from specific fields
        const participant = {
            id: Date.now().toString(),
            firstName: pdfData['1.2'] || '',
            lastName: pdfData['1.1'] || '',
            dateStart: pdfData['1.6'] || '',
            dateEnd: pdfData['1.7'] || '',
            courseType: pdfData['1.68'] || '',
            workPercent: 100,
            schedule: {
                '1-am': true, '1-pm': true,
                '2-am': true, '2-pm': true,
                '3-am': true, '3-pm': true,
                '4-am': true, '4-pm': true,
                '5-am': true, '5-pm': true
            },
            pdfData: pdfData  // NOUVEAU : Toutes les données du PDF
        };

        return participant;
    } catch (error) {
        console.error('Error parsing PDF:', error);
        throw error;
    }
}
