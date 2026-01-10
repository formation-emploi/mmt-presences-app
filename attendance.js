/**
 * Attendance Service with updated attendance codes
 */

// Attendance codes with full descriptions
const ATTENDANCE_CODES = {
    'X': {
        code: 'X',
        label: 'Sur place',
        description: 'PARTICIPATION SUR PLACE : le participant est présent',
        requiresComment: false
    },
    'O': {
        code: 'O',
        label: 'En ligne',
        description: 'PARTICIPATION EN LIGNE',
        requiresComment: false
    },
    'A': {
        code: 'A',
        label: 'Vacances',
        description: 'VACANCES : jours sans contrôle accordés par l\'ORP, selon autorisation écrite',
        requiresComment: false
    },
    'B': {
        code: 'B',
        label: 'Maladie/Grossesse',
        description: 'MALADIE, GROSSESSE : certificat médical requis dès le 4e jour, le temps nécessaire',
        requiresComment: false
    },
    'C': {
        code: 'C',
        label: 'Accident',
        description: 'ACCIDENT : certificat médical requis dès le 4e jour, le temps nécessaire',
        requiresComment: false
    },
    'D': {
        code: 'D',
        label: 'Congé maternité/parental',
        description: 'CONGÉ MATERNITÉ, CONGÉ DE L\'AUTRE PARENT : selon la durée prévue',
        requiresComment: false
    },
    'E': {
        code: 'E',
        label: 'Service militaire/civil',
        description: 'SERVICE MILITAIRE, SERVICE CIVIL, PROTECTION CIVILE : selon la durée prévue',
        requiresComment: false
    },
    'F': {
        code: 'F',
        label: 'Gain intermédiaire',
        description: 'GAIN INTERMÉDIAIRE : auprès d\'un employeur, selon la durée prévue',
        requiresComment: false
    },
    'G': {
        code: 'G',
        label: 'Autres absences justifiées',
        description: 'AUTRES ABSENCES JUSTIFIÉES AVEC INDEMNITÉ DE CHÔMAGE incluant : Mariage (3j), Naissance (3j), Décès proche (3j), Funérailles (1j), Déménagement (1j), Inspection militaire (½-1j), Visite médicale, Assistance proche malade (3j), Entretien ORP, Entretien d\'embauche, Rendez-vous officiel, Essai en entreprise, Autre absence autorisée par l\'ORP',
        requiresComment: true
    },
    'H': {
        code: 'H',
        label: 'Jours fériés/Fermeture',
        description: 'JOURS FÉRIÉS, VACANCES D\'ENTREPRISE, FERMETURE DE LA MESURE : selon la durée prévue',
        requiresComment: false
    },
    'I': {
        code: 'I',
        label: 'Absence non justifiée',
        description: 'ABSENCES NON JUSTIFIÉES : doit être choisi lorsque le participant s\'est absenté sans fournir d\'excuse au préalable',
        requiresComment: false
    }
};

class AttendanceService {
    async saveAttendance(attendanceRecords) {
        // attendanceRecords is an array of { date, classId, participantId, morningCode, afternoonCode, comment }
        // We need to generate a unique ID for each record or use a composite key strategy.
        // For simple IDB, we can use a string key: "classId_date_participantId"

        const promises = attendanceRecords.map(record => {
            const id = `${record.classId}_${record.date}_${record.participantId}`;
            const item = { ...record, id };
            return dbService.update(STORES.ATTENDANCE, item);
        });

        return Promise.all(promises);
    }

    async getAttendance(classId, date) {
        const all = await dbService.getAll(STORES.ATTENDANCE);
        return all.filter(r => r.classId === classId && r.date === date);
    }

    async markAsChecked(classId, date) {
        // Mark attendance as checked for a specific class and date
        const checkId = `check_${classId}_${date}`;
        const data = {
            id: checkId,
            classId,
            date,
            checked: true,
            checkedAt: new Date().toISOString()
        };
        console.log('💾 markAsChecked - Saving with ID:', checkId);
        console.log('💾 markAsChecked - Data:', data);
        const result = await dbService.update(STORES.ATTENDANCE, data);
        console.log('✅ markAsChecked - Save result:', result);
        return result;
    }

    async isChecked(classId, date) {
        // Check if attendance has been marked as checked
        const checkId = `check_${classId}_${date}`;
        console.log('🔍 isChecked - Looking for ID:', checkId);
        try {
            // Use getAll since dbService.get() doesn't exist
            const allRecords = await dbService.getAll(STORES.ATTENDANCE);
            const record = allRecords.find(r => r.id === checkId);
            console.log('📄 isChecked - Record found:', record);
            const result = record && record.checked;
            console.log('✅ isChecked - Returning:', result);
            return result;
        } catch (error) {
            console.error('❌ isChecked - Error:', error);
            return false;
        }
    }
}

window.attendanceService = new AttendanceService();
window.ATTENDANCE_CODES = ATTENDANCE_CODES;
