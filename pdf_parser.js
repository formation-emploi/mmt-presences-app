/**
 * PDF Parser Service for MMT Forms - Using pdf-lib with field mapping
 * Version 5.0 - Final version with complete field mapping
 */

// Field mapping based on manual identification
const FIELD_MAPPING = {
    // Page 1 - Participant info
    '1.2': 'lastName',           // Nom
    '1.3': 'firstName',          // Prénom
    'Textfeld 43': 'avsNumber',  // N° AVS (alternative)
    'Textfeld 61': 'avsNumber',  // N° AVS
    'Textfeld 42': 'birthDate',  // Date de naissance
    'Textfeld 41': 'monthYear',  // Mois et année

    // MMT Details
    '1.68': 'courseType',        // Titre de la MMT
    '1.49': 'dateStart',         // Début de la mesure
    '1.48': 'dateEnd',           // Fin de la mesure
    '1.46': 'workPercent',       // Taux d'occupation
    '1.139': 'decisionNumber',   // N° de décision
    '1.141': 'unemploymentOffice', // Caisse de chômage
    '1.67': 'executionPlace',    // Lieu d'exécution

    // Organizer info
    '1.4': 'organizerName',      // Organisateur MMT
    '1.32': 'organizerLastName', // Nom organisateur
    '1.56': 'organizerFirstName',// Prénom organisateur
    '1.61': 'organizerPhone',    // Téléphone
    '1.62': 'organizerEmail',    // Email

    // Other
    'Kontrollkästchen 6': 'noParticipation',  // Pas de participation
    'Kontrollkästchen 7': 'isCorrection',     // Correction
    'Optionsfeld 70': 'wasInterrupted',       // Interruption
    '1.63': 'interruptionDate',  // Date d'interruption

    // Signature
    '5.19': 'signaturePlace',    // Lieu
    'Textfeld 103': 'signatureDate', // Date signature
    '5.25': 'signature'          // Signature
};

// Attendance fields mapping (days 1-31, AM/PM)
const ATTENDANCE_FIELDS = {
    1: { am: '2.10146', pm: '2.10147' },
    2: { am: '2.10148', pm: '2.10149' },
    3: { am: '2.10150', pm: '2.10151' },
    4: { am: '2.10152', pm: '2.10153' },
    5: { am: '2.335', pm: '2.336' },
    6: { am: '2.337', pm: '2.338' },
    7: { am: '2.339', pm: '2.340' },
    8: { am: '2.341', pm: '2.342' },
    9: { am: '2.2031', pm: '2.2032' },
    10: { am: '2.2033', pm: '2.2034' },
    11: { am: '2.2035', pm: '2.2036' },
    12: { am: '2.2037', pm: '2.2038' },
    13: { am: '2.2039', pm: '2.2040' },
    14: { am: '2.343', pm: '2.3010' },
    15: { am: '2.3011', pm: '2.3012' },
    16: { am: '2.3013', pm: '2.3014' },
    17: { am: '2.3015', pm: '2.3016' },
    18: { am: '2.3017', pm: '2.3018' },
    19: { am: '2.3019', pm: '2.344' },
    20: { am: '2.345', pm: '2.346' },
    21: { am: '2.347', pm: '2.348' },
    22: { am: '2.349', pm: '2.350' },
    23: { am: '2.351', pm: '2.352' },
    24: { am: '2.353', pm: '2.354' },
    25: { am: '2.355', pm: '2.356' },
    26: { am: '2.357', pm: '2.358' },
    27: { am: '2.359', pm: '2.360' },
    28: { am: '2.361', pm: '2.362' },
    29: { am: '2.363', pm: '2.364' },
    30: { am: '2.365', pm: '2.366' },
    31: { am: '2.367', pm: '2.368' }
};

async function parsePDF(file) {
    if (typeof PDFLib === 'undefined') {
        throw new Error('pdf-lib library is not loaded. Please include it in index.html');
    }

    console.log('=== MMT PDF PARSER v5.0 (Field Mapping) ===');
    console.log('File:', file.name);

    try {
        const arrayBuffer = await file.arrayBuffer();
        const pdfDoc = await PDFLib.PDFDocument.load(arrayBuffer);
        const form = pdfDoc.getForm();
        const fields = form.getFields();

        console.log(`Found ${fields.length} form fields`);

        // Create a map of field names to values
        const fieldData = {};
        fields.forEach(field => {
            const name = field.getName();
            let value = '';

            try {
                // Try different methods to read the value
                if (typeof field.getText === 'function') {
                    value = field.getText() || '';
                } else if (typeof field.isChecked === 'function') {
                    value = field.isChecked();
                } else if (typeof field.getSelected === 'function') {
                    value = field.getSelected() || '';
                }

                // Try to access raw value from acroField
                if (!value && field.acroField && field.acroField.dict) {
                    const vEntry = field.acroField.dict.lookup(PDFLib.PDFName.of('V'));
                    if (vEntry) {
                        if (vEntry instanceof PDFLib.PDFString) {
                            value = vEntry.decodeText();
                        } else if (vEntry instanceof PDFLib.PDFName) {
                            value = vEntry.asString();
                        } else if (vEntry instanceof PDFLib.PDFHexString) {
                            value = vEntry.decodeText();
                        }
                    }
                }
            } catch (e) {
                console.warn(`Could not read field ${name}:`, e);
            }

            if (value) {
                fieldData[name] = value;
                console.log(`Field "${name}": "${value}"`);
            }
        });

        // Extract participant data using field mapping
        const result = {
            firstName: '',
            lastName: '',
            courseType: '',
            dateStart: '',
            dateEnd: '',
            workPercent: 100,
            avsNumber: '',
            birthDate: '',
            monthYear: '',
            attendance: { days: {}, comments: '' }
        };

        // Map fields to result
        for (const [fieldName, propertyName] of Object.entries(FIELD_MAPPING)) {
            if (fieldData[fieldName]) {
                result[propertyName] = fieldData[fieldName];
                console.log(`✅ Mapped ${propertyName}: ${fieldData[fieldName]}`);
            }
        }

        // Parse dates
        if (result.dateStart) {
            result.dateStart = parseDate(result.dateStart);
        }
        if (result.dateEnd) {
            result.dateEnd = parseDate(result.dateEnd);
        }
        if (result.birthDate) {
            result.birthDate = parseDate(result.birthDate);
        }

        // Parse work percent
        if (result.workPercent) {
            const match = String(result.workPercent).match(/(\d+)/);
            if (match) {
                result.workPercent = parseInt(match[1]);
            } else {
                result.workPercent = 100;
            }
        }

        // Extract attendance data
        for (const [day, fieldNames] of Object.entries(ATTENDANCE_FIELDS)) {
            const amValue = fieldData[fieldNames.am] || '';
            const pmValue = fieldData[fieldNames.pm] || '';

            if (amValue || pmValue) {
                result.attendance.days[day] = {
                    am: amValue,
                    pm: pmValue
                };
            }
        }

        // FALLBACK: Extract from filename if critical fields are empty
        if (!result.firstName || !result.lastName) {
            console.log('=== Applying filename fallback ===');
            const filenameData = extractFromFilename(file.name);

            if (!result.firstName) result.firstName = filenameData.firstName;
            if (!result.lastName) result.lastName = filenameData.lastName;
            if (!result.courseType) result.courseType = filenameData.courseType;
            if (!result.dateStart) result.dateStart = filenameData.dateStart;
            if (!result.dateEnd) result.dateEnd = filenameData.dateEnd;
        }

        if (!result.lastName) {
            throw new Error("Impossible d'extraire le nom du participant du PDF.");
        }

        // Ensure firstName is at least empty string
        if (!result.firstName) {
            result.firstName = '';
        }

        console.log('=== FINAL RESULT ===');
        console.log(result);

        return result;

    } catch (error) {
        console.error('Error parsing PDF:', error);
        throw error;
    }
}

function parseDate(dateStr) {
    if (!dateStr) return '';

    // Remove any whitespace
    dateStr = dateStr.trim();

    // Try various date formats
    // DD.MM.YYYY
    let match = dateStr.match(/(\d{1,2})\.(\d{1,2})\.(\d{4})/);
    if (match) {
        return `${match[3]}-${match[2].padStart(2, '0')}-${match[1].padStart(2, '0')}`;
    }

    // DD/MM/YYYY
    match = dateStr.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
    if (match) {
        return `${match[3]}-${match[2].padStart(2, '0')}-${match[1].padStart(2, '0')}`;
    }

    // YYYY-MM-DD (already correct)
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
        return dateStr;
    }

    // DDMMYYYY (8 digits)
    match = dateStr.match(/^(\d{2})(\d{2})(\d{4})$/);
    if (match) {
        return `${match[3]}-${match[2]}-${match[1]}`;
    }

    // JJMMAAAA with spaces (J J M M A A A A)
    const cleaned = dateStr.replace(/\s+/g, '');
    if (cleaned.length === 8 && /^\d{8}$/.test(cleaned)) {
        return `${cleaned.substring(4, 8)}-${cleaned.substring(2, 4)}-${cleaned.substring(0, 2)}`;
    }

    return dateStr;
}

function extractFromFilename(filename) {
    const result = {
        firstName: '',
        lastName: '',
        courseType: '',
        dateStart: '',
        dateEnd: ''
    };

    const filenameParts = filename.replace('.pdf', '').split('_');

    if (filenameParts.length >= 4) {
        if (filenameParts[1]) {
            result.courseType = filenameParts[1];
        }

        if (filenameParts[2]) {
            const { firstName, lastName } = splitFullName(filenameParts[2]);
            result.firstName = firstName;
            result.lastName = lastName;
        }

        if (filenameParts[3] && filenameParts[3].match(/(\d{4})(\d{2})(\d{2})/)) {
            const dateMatch = filenameParts[3].match(/(\d{4})(\d{2})(\d{2})/);
            const year = dateMatch[1];
            const month = dateMatch[2];

            result.dateStart = `${year}-${month}-01`;
            const lastDay = new Date(parseInt(year), parseInt(month), 0).getDate();
            result.dateEnd = `${year}-${month}-${String(lastDay).padStart(2, '0')}`;
        }
    }

    return result;
}

function splitFullName(fullName) {
    const capitals = [];
    for (let i = 0; i < fullName.length; i++) {
        if (fullName[i] === fullName[i].toUpperCase() && /[A-ZÀ-Ÿ]/.test(fullName[i])) {
            capitals.push(i);
        }
    }

    if (capitals.length >= 2) {
        const splitIndex = capitals[capitals.length - 1];
        const lastName = fullName.substring(0, splitIndex);
        const firstName = fullName.substring(splitIndex);
        return { firstName, lastName };
    }

    return { firstName: '', lastName: fullName };
}
