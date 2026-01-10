/**
 * PDF Generator Service for MMT Forms
 * Fills PDF forms with participant and attendance data
 */

const PDF_MAPPING = {
    // Metadata
    monthYear: 'Textfeld 98', // #41
    currentDate: 'Textfeld 103', // #109
    location: '5.19', // #107 - Porrentruy
    comments: '1.172', // #30 - Justifications

    // Checkboxes/Radios
    presenceType: {
        name: 'Optionsfeld 6', // #44
        value: 'Auswahl1'
    },
    interruption: {
        name: 'Optionsfeld 70',
        value: 'selection2',
        date: '1.63'
    },

    // Attendance Grid (Day 1 AM, Day 1 PM, Day 2 AM, Day 2 PM, ...)
    attendanceFields: [
        '2.10146', '2.10147', // Day 1
        '2.3015', '2.3016',   // Day 2
        '2.2031', '2.2032',   // Day 3
        '2.355', '2.356',     // Day 4
        '2.335', '2.336',     // Day 5
        '2.347', '2.348',     // Day 6
        '2.2039', '2.2040',   // Day 7
        '2.363', '2.364',     // Day 8
        '2.10150', '2.10151', // Day 9
        '2.3019', '2.344',    // Day 10
        '2.2035', '2.2036',   // Day 11
        '2.359', '2.360',     // Day 12
        '2.339', '2.340',     // Day 13
        '2.351', '2.352',     // Day 14
        '2.3011', '2.3012',   // Day 15
        '2.367', '2.368',     // Day 16
        '2.10148', '2.10149', // Day 17
        '2.3017', '2.3018',   // Day 18
        '2.2033', '2.2034',   // Day 19
        '2.357', '2.358',     // Day 20
        '2.337', '2.338',     // Day 21
        '2.349', '2.350',     // Day 22
        '2.343', '2.3010',    // Day 23
        '2.365', '2.366',     // Day 24
        '2.10152', '2.10153', // Day 25
        '2.345', '2.346',     // Day 26
        '2.2037', '2.2038',   // Day 27
        '2.361', '2.362',     // Day 28
        '2.341', '2.342',     // Day 29
        '2.353', '2.354',     // Day 30
        '2.3013', '2.3014'    // Day 31
    ]
};


async function generatePDF(participant, attendanceData, templateBytes, signatureDate, isCorrection = false, signatureImageBase64 = null) {
    if (typeof PDFLib === 'undefined') {
        throw new Error('La librairie PDFLib n\'est pas chargée.');
    }

    try {
        const pdfDoc = await PDFLib.PDFDocument.load(templateBytes);
        const helveticaFont = await pdfDoc.embedFont(PDFLib.StandardFonts.Helvetica);
        const form = pdfDoc.getForm();

        // 1. Fill Month/Year (MMYYYY format)
        let monthYearStr = '';
        const dashboardMonth = document.getElementById('dashboard-month');
        if (dashboardMonth && dashboardMonth.value) {
            const [y, m] = dashboardMonth.value.split('-');
            monthYearStr = `${m}${y}`;
        } else {
            const now = new Date();
            monthYearStr = `${String(now.getMonth() + 1).padStart(2, '0')}${now.getFullYear()}`;
        }
        trySetField(form, PDF_MAPPING.monthYear, monthYearStr, helveticaFont);

        // 2a. Fill Signature Date (DDMMYYYY format)
        let dateStr;
        if (signatureDate) { // Expecting DD.MM.YYYY
            dateStr = signatureDate.replace(/\./g, ''); // -> DDMMYYYY
        } else {
            const now = new Date();
            dateStr = `${String(now.getDate()).padStart(2, '0')}${String(now.getMonth() + 1).padStart(2, '0')}${now.getFullYear()}`;
        }
        trySetField(form, PDF_MAPPING.currentDate, dateStr, helveticaFont);

        // 2b. Set "Correction" box (Kontrollkästchen 7)
        if (isCorrection) {
            try {
                console.log('Setting Correction field (Kontrollkästchen 7)');
                const field = form.getField('Kontrollkästchen 7');
                if (field instanceof PDFLib.PDFCheckBox) {
                    field.check();
                    console.log('✓ Correction checked via CheckBox');
                } else if (field instanceof PDFLib.PDFRadioGroup) {
                    // Try common "Yes" values
                    const options = field.getOptions();
                    const match = options.find(o => ['yes', 'oui', '1', 'on', 'selection2', 'auswahl2'].includes(o.toLowerCase()));
                    if (match) {
                        field.select(match);
                        console.log(`✓ Correction checked via RadioGroup (${match})`);
                    } else {
                        console.warn('Could not find "Yes" option for Correction radio group:', options);
                    }
                }
            } catch (e) {
                console.warn('Could not check Kontrollkästchen 7:', e);
            }
        }

        // 3. Fill Location
        trySetField(form, PDF_MAPPING.location, 'Porrentruy', helveticaFont);

        // 4. Set Radio Field (Optionsfeld 6 -> Auswahl1)
        try {
            const radioField = form.getRadioGroup('Optionsfeld 6');
            radioField.select('Auswahl1');
            console.log(`✓ Radio field "Optionsfeld 6" set to "Auswahl1"`);
        } catch (e) {
            console.error(`❌ Could not set radio field:`, e);
        }

        // 4b. Set Interruption MMT
        // Mapping based on debug info:
        // Options available: ["Auswahl1" (Non), "Auswahl2" (Oui)]
        try {
            console.log('Setting Interruption MMT (Field: Optionsfeld 70)');
            const radioGroup = form.getRadioGroup('Optionsfeld 70');

            // Logic: If interruption is TRUE -> Oui -> Auswahl2
            // If interruption is FALSE -> Non -> Auswahl1
            const targetValue = participant.interruptionMMT ? 'Auswahl2' : 'Auswahl1';

            radioGroup.select(targetValue);
            console.log(`✓ Interruption MMT set to: ${targetValue} (${participant.interruptionMMT ? 'Oui' : 'Non'})`);

        } catch (e) {
            console.warn('Could not set Optionsfeld 70:', e.message);
        }

        // 4c. Set Interruption Date
        if (participant.interruptionDate) {
            try {
                const [y, m, d] = participant.interruptionDate.split('-');
                const formattedDate = `${d}${m}${y}`;
                trySetField(form, PDF_MAPPING.interruption.date, formattedDate, helveticaFont);
            } catch (e) {
                console.warn(`Could not set Interruption Date`, e);
            }
        }

        // 5. Fill Attendance Grid
        const [year, month] = (dashboardMonth && dashboardMonth.value) ? dashboardMonth.value.split('-') : [now.getFullYear(), String(now.getMonth() + 1).padStart(2, '0')];
        const daysInMonth = new Date(year, month, 0).getDate();
        let commentsList = [];
        let fieldIndex = 0;

        for (let d = 1; d <= 31; d++) {
            if (d > daysInMonth) {
                fieldIndex += 2;
                continue;
            }

            const dateKey = `${year}-${month}-${String(d).padStart(2, '0')}`;
            const record = attendanceData.find(r => r.date === dateKey);

            const amCode = record ? (record.morningCode === 'P' ? 'X' : (record.morningCode || '')) : '';
            const pmCode = record ? (record.afternoonCode === 'P' ? 'X' : (record.afternoonCode || '')) : '';

            if (fieldIndex < PDF_MAPPING.attendanceFields.length) {
                trySetField(form, PDF_MAPPING.attendanceFields[fieldIndex], amCode, helveticaFont);
            }
            fieldIndex++;

            if (fieldIndex < PDF_MAPPING.attendanceFields.length) {
                trySetField(form, PDF_MAPPING.attendanceFields[fieldIndex], pmCode, helveticaFont);
            }
            fieldIndex++;

            if (record && record.comment && record.comment.trim() !== '') {
                const dayStr = String(d).padStart(2, '0');
                commentsList.push(`${dayStr}.${month} "${record.comment}"`);
            }
        }

        // 6. Fill Comments
        if (commentsList.length > 0) {
            trySetField(form, PDF_MAPPING.comments, commentsList.join(' / '), helveticaFont);
        }

        // 6b. Add Signature Image to field #108 - 5.25
        if (signatureImageBase64) {
            try {
                console.log('📝 Adding signature image to field 5.25...');

                // Convert base64 to bytes
                const base64Data = signatureImageBase64.split(',')[1]; // Remove data:image/png;base64,
                const imageBytes = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));

                // Embed the image
                let image;
                if (signatureImageBase64.includes('image/png')) {
                    image = await pdfDoc.embedPng(imageBytes);
                } else if (signatureImageBase64.includes('image/jpeg') || signatureImageBase64.includes('image/jpg')) {
                    image = await pdfDoc.embedJpg(imageBytes);
                } else {
                    throw new Error('Format d\'image non supporté');
                }

                // Get the signature button field (5.25)
                const signatureField = form.getButton('5.25');
                const widgets = signatureField.acroField.getWidgets();

                if (widgets.length > 0) {
                    const widget = widgets[0];
                    const rect = widget.getRectangle();
                    const page = pdfDoc.getPages()[0]; // Assuming first page

                    // Calculate dimensions to fit in the field
                    const fieldWidth = rect.width;
                    const fieldHeight = rect.height;
                    const imageDims = image.scale(1);

                    let scale = Math.min(
                        fieldWidth / imageDims.width,
                        fieldHeight / imageDims.height
                    );
                    scale = Math.min(scale, 1); // Don't upscale

                    const scaledWidth = imageDims.width * scale;
                    const scaledHeight = imageDims.height * scale;

                    // Center the image in the field
                    const x = rect.x + (fieldWidth - scaledWidth) / 2;
                    const y = rect.y + (fieldHeight - scaledHeight) / 2;

                    // Draw the image on the page
                    page.drawImage(image, {
                        x: x,
                        y: y,
                        width: scaledWidth,
                        height: scaledHeight
                    });

                    console.log('✅ Signature image added successfully');
                }
            } catch (e) {
                console.warn('⚠️ Could not add signature image:', e);
                // Continue without signature if there's an error
            }
        }

        // 7. Flatten form to force Helvetica
        console.log('⚠️ Flattening form to force Helvetica font...');
        try {
            form.flatten();
            console.log('✅ Form flattened - Helvetica applied');
        } catch (e) {
            console.warn('⚠️ Could not flatten:', e.message);
        }

        return await pdfDoc.save();

    } catch (error) {
        console.error('Error generating PDF:', error);
        throw error;
    }
}

function trySetField(form, fieldName, value, font) {
    try {
        const field = form.getTextField(fieldName);
        field.setText(String(value));

        if (font) {
            field.updateAppearances(font);
            try {
                const da = PDFLib.PDFString.of('/Helvetica 10 Tf 0 g');
                field.acroField.dict.set(PDFLib.PDFName.of('DA'), da);
            } catch (e) { }
        }
    } catch (e) {
        console.warn(`⚠ Could not set field "${fieldName}":`, e.message);
    }
}

window.pdfGenerator = {
    generatePDF
};
