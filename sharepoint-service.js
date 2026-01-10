/**
 * SharePoint Service - Gestion des données dans SharePoint
 * Remplace localStorage par des appels API SharePoint REST
 */

class SharePointService {
    constructor() {
        // URL de votre site SharePoint
        this.siteUrl = 'https://formationemploi.sharepoint.com/sites/TestapplicationMMT';

        // Noms des listes SharePoint
        this.lists = {
            participants: 'MMT_Participants',
            classes: 'MMT_Classes',
            attendances: 'MMT_Attendances',
            classParticipants: 'MMT_ClassParticipants'
        };

        // Cache local pour améliorer les performances
        this.cache = {
            participants: null,
            classes: null,
            attendances: null
        };
    }

    /**
     * Obtenir le token d'authentification SharePoint
     */
    async getRequestDigest() {
        try {
            const response = await fetch(`${this.siteUrl}/_api/contextinfo`, {
                method: 'POST',
                headers: {
                    'Accept': 'application/json;odata=verbose',
                    'Content-Type': 'application/json;odata=verbose'
                },
                credentials: 'include'
            });

            const data = await response.json();
            return data.d.GetContextWebInformation.FormDigestValue;
        } catch (error) {
            console.error('Erreur lors de l\'obtention du token:', error);
            throw error;
        }
    }

    /**
     * Effectuer une requête GET vers SharePoint
     */
    async get(listName, filter = '', select = '', expand = '') {
        try {
            let url = `${this.siteUrl}/_api/web/lists/getbytitle('${listName}')/items`;

            const params = [];
            if (select) params.push(`$select=${select}`);
            if (filter) params.push(`$filter=${filter}`);
            if (expand) params.push(`$expand=${expand}`);

            if (params.length > 0) {
                url += '?' + params.join('&');
            }

            const response = await fetch(url, {
                method: 'GET',
                headers: {
                    'Accept': 'application/json;odata=verbose',
                    'Content-Type': 'application/json;odata=verbose'
                },
                credentials: 'include'
            });

            if (!response.ok) {
                throw new Error(`Erreur HTTP: ${response.status}`);
            }

            const data = await response.json();
            return data.d.results;
        } catch (error) {
            console.error(`Erreur lors de la lecture de ${listName}:`, error);
            throw error;
        }
    }

    /**
     * Créer un élément dans une liste SharePoint
     */
    async create(listName, item) {
        try {
            const digest = await this.getRequestDigest();

            const response = await fetch(`${this.siteUrl}/_api/web/lists/getbytitle('${listName}')/items`, {
                method: 'POST',
                headers: {
                    'Accept': 'application/json;odata=verbose',
                    'Content-Type': 'application/json;odata=verbose',
                    'X-RequestDigest': digest
                },
                credentials: 'include',
                body: JSON.stringify({
                    '__metadata': { 'type': `SP.Data.${listName}ListItem` },
                    ...item
                })
            });

            if (!response.ok) {
                throw new Error(`Erreur HTTP: ${response.status}`);
            }

            const data = await response.json();
            return data.d;
        } catch (error) {
            console.error(`Erreur lors de la création dans ${listName}:`, error);
            throw error;
        }
    }

    /**
     * Mettre à jour un élément dans une liste SharePoint
     */
    async update(listName, itemId, item) {
        try {
            const digest = await this.getRequestDigest();

            const response = await fetch(`${this.siteUrl}/_api/web/lists/getbytitle('${listName}')/items(${itemId})`, {
                method: 'POST',
                headers: {
                    'Accept': 'application/json;odata=verbose',
                    'Content-Type': 'application/json;odata=verbose',
                    'X-RequestDigest': digest,
                    'X-HTTP-Method': 'MERGE',
                    'IF-MATCH': '*'
                },
                credentials: 'include',
                body: JSON.stringify({
                    '__metadata': { 'type': `SP.Data.${listName}ListItem` },
                    ...item
                })
            });

            if (!response.ok && response.status !== 204) {
                throw new Error(`Erreur HTTP: ${response.status}`);
            }

            return true;
        } catch (error) {
            console.error(`Erreur lors de la mise à jour dans ${listName}:`, error);
            throw error;
        }
    }

    /**
     * Supprimer un élément d'une liste SharePoint
     */
    async delete(listName, itemId) {
        try {
            const digest = await this.getRequestDigest();

            const response = await fetch(`${this.siteUrl}/_api/web/lists/getbytitle('${listName}')/items(${itemId})`, {
                method: 'POST',
                headers: {
                    'Accept': 'application/json;odata=verbose',
                    'X-RequestDigest': digest,
                    'X-HTTP-Method': 'DELETE',
                    'IF-MATCH': '*'
                },
                credentials: 'include'
            });

            if (!response.ok && response.status !== 204) {
                throw new Error(`Erreur HTTP: ${response.status}`);
            }

            return true;
        } catch (error) {
            console.error(`Erreur lors de la suppression dans ${listName}:`, error);
            throw error;
        }
    }

    // ========================================
    // MÉTHODES SPÉCIFIQUES POUR L'APPLICATION MMT
    // ========================================

    /**
     * Récupérer tous les participants
     */
    async getParticipants() {
        if (this.cache.participants) {
            return this.cache.participants;
        }

        const items = await this.get(this.lists.participants);
        this.cache.participants = items.map(item => ({
            id: item.ID,
            firstname: item.Firstname,
            lastname: item.Lastname,
            workPercent: item.WorkPercent,
            dateStart: item.DateStart,
            dateEnd: item.DateEnd,
            interruptionMMT: item.InterruptionMMT,
            interruptionDate: item.InterruptionDate,
            schedule: JSON.parse(item.Schedule || '{}')
        }));

        return this.cache.participants;
    }

    /**
     * Sauvegarder un participant
     */
    async saveParticipant(participant) {
        const spItem = {
            Firstname: participant.firstname,
            Lastname: participant.lastname,
            WorkPercent: participant.workPercent,
            DateStart: participant.dateStart,
            DateEnd: participant.dateEnd,
            InterruptionMMT: participant.interruptionMMT,
            InterruptionDate: participant.interruptionDate,
            Schedule: JSON.stringify(participant.schedule)
        };

        if (participant.id) {
            await this.update(this.lists.participants, participant.id, spItem);
        } else {
            const newItem = await this.create(this.lists.participants, spItem);
            participant.id = newItem.ID;
        }

        this.cache.participants = null; // Invalider le cache
        return participant;
    }

    /**
     * Supprimer un participant
     */
    async deleteParticipant(participantId) {
        await this.delete(this.lists.participants, participantId);
        this.cache.participants = null; // Invalider le cache
    }

    /**
     * Récupérer toutes les classes
     */
    async getClasses() {
        if (this.cache.classes) {
            return this.cache.classes;
        }

        const items = await this.get(this.lists.classes);
        this.cache.classes = items.map(item => ({
            id: item.ID,
            name: item.Title,
            description: item.Description,
            participants: JSON.parse(item.Participants || '[]')
        }));

        return this.cache.classes;
    }

    /**
     * Sauvegarder une classe
     */
    async saveClass(classItem) {
        const spItem = {
            Title: classItem.name,
            Description: classItem.description,
            Participants: JSON.stringify(classItem.participants)
        };

        if (classItem.id) {
            await this.update(this.lists.classes, classItem.id, spItem);
        } else {
            const newItem = await this.create(this.lists.classes, spItem);
            classItem.id = newItem.ID;
        }

        this.cache.classes = null; // Invalider le cache
        return classItem;
    }

    /**
     * Supprimer une classe
     */
    async deleteClass(classId) {
        await this.delete(this.lists.classes, classId);
        this.cache.classes = null; // Invalider le cache
    }

    /**
     * Récupérer les présences
     */
    async getAttendances(classId = null, date = null) {
        let filter = '';
        if (classId) filter = `ClassId eq ${classId}`;
        if (date) {
            if (filter) filter += ' and ';
            filter += `AttendanceDate eq '${date}'`;
        }

        const items = await this.get(this.lists.attendances, filter);
        return items.map(item => ({
            id: item.ID,
            classId: item.ClassId,
            participantId: item.ParticipantId,
            date: item.AttendanceDate,
            code: item.AttendanceCode,
            period: item.Period
        }));
    }

    /**
     * Sauvegarder une présence
     */
    async saveAttendance(attendance) {
        const spItem = {
            ClassId: attendance.classId,
            ParticipantId: attendance.participantId,
            AttendanceDate: attendance.date,
            AttendanceCode: attendance.code,
            Period: attendance.period
        };

        if (attendance.id) {
            await this.update(this.lists.attendances, attendance.id, spItem);
        } else {
            const newItem = await this.create(this.lists.attendances, spItem);
            attendance.id = newItem.ID;
        }

        return attendance;
    }

    /**
     * Vérifier si les listes SharePoint existent
     */
    async checkLists() {
        try {
            const response = await fetch(`${this.siteUrl}/_api/web/lists`, {
                method: 'GET',
                headers: {
                    'Accept': 'application/json;odata=verbose'
                },
                credentials: 'include'
            });

            const data = await response.json();
            const listTitles = data.d.results.map(list => list.Title);

            const missingLists = [];
            Object.values(this.lists).forEach(listName => {
                if (!listTitles.includes(listName)) {
                    missingLists.push(listName);
                }
            });

            if (missingLists.length > 0) {
                console.warn('Listes SharePoint manquantes:', missingLists);
                return { success: false, missingLists };
            }

            return { success: true };
        } catch (error) {
            console.error('Erreur lors de la vérification des listes:', error);
            return { success: false, error };
        }
    }
}

// Créer une instance globale
window.spService = new SharePointService();
