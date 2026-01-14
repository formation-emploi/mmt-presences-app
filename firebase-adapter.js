/**
 * Firebase Adapter - Remplace localStorage par Firebase Firestore
 * Compatible avec l'ancien code de l'application
 */

import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js';
import { getFirestore, collection, doc, getDocs, getDoc, setDoc, updateDoc, deleteDoc, addDoc } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';

// Configuration Firebase
const firebaseConfig = {
    apiKey: "AIzaSyC9Jp7YGeYxYja5rIRXSdVQFvVMmiMU7Ko",
    authDomain: "mmt-presences-app.firebaseapp.com",
    projectId: "mmt-presences-app",
    storageBucket: "mmt-presences-app.firebasestorage.app",
    messagingSenderId: "859089098904",
    appId: "1:859089098904:web:4dc75d1d2813509278d8ed"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

/**
 * Adaptateur de stockage compatible avec l'ancien code localStorage
 */
class FirebaseStorageAdapter {
    constructor() {
        this.cache = {};
        this.initialized = false;
    }

    /**
     * Initialiser le cache depuis Firebase
     */
    async init() {
        if (this.initialized) return;

        try {
            // Charger les participants
            const participantsSnap = await getDocs(collection(db, 'participants'));
            const participants = [];
            participantsSnap.forEach(doc => {
                participants.push({ id: doc.id, ...doc.data() });
            });
            this.cache.participants = participants;

            // Charger les classes
            const classesSnap = await getDocs(collection(db, 'classes'));
            const classes = [];
            classesSnap.forEach(doc => {
                classes.push({ id: doc.id, ...doc.data() });
            });
            this.cache.classes = classes;

            // Charger les présences
            const attendancesSnap = await getDocs(collection(db, 'attendances'));
            const attendances = [];
            attendancesSnap.forEach(doc => {
                attendances.push({ id: doc.id, ...doc.data() });
            });
            this.cache.attendances = attendances;

            this.initialized = true;
            console.log('✅ Firebase cache initialized');
        } catch (error) {
            console.error('❌ Error initializing Firebase cache:', error);
            // Fallback sur localStorage si Firebase échoue
            this.loadFromLocalStorage();
        }
    }

    /**
     * Charger depuis localStorage (fallback)
     */
    loadFromLocalStorage() {
        this.cache.participants = JSON.parse(localStorage.getItem('participants') || '[]');
        this.cache.classes = JSON.parse(localStorage.getItem('classes') || '[]');
        this.cache.attendances = JSON.parse(localStorage.getItem('attendances') || '[]');
        console.log('⚠️ Loaded from localStorage (fallback)');
    }

    /**
     * Obtenir tous les participants
     */
    async getParticipants() {
        await this.init();
        return this.cache.participants || [];
    }

    /**
     * Sauvegarder un participant
     */
    async saveParticipant(participant) {
        await this.init();

        try {
            if (participant.id) {
                // Mise à jour
                const docRef = doc(db, 'participants', participant.id);
                await setDoc(docRef, participant);

                // Mettre à jour le cache
                const index = this.cache.participants.findIndex(p => p.id === participant.id);
                if (index !== -1) {
                    this.cache.participants[index] = participant;
                } else {
                    this.cache.participants.push(participant);
                }
            } else {
                // Création
                const docRef = await addDoc(collection(db, 'participants'), participant);
                participant.id = docRef.id;
                this.cache.participants.push(participant);
            }

            console.log('✅ Participant saved to Firebase:', participant.id);
            return participant;
        } catch (error) {
            console.error('❌ Error saving participant:', error);
            throw error;
        }
    }

    /**
     * Supprimer un participant
     */
    async deleteParticipant(participantId) {
        await this.init();

        try {
            await deleteDoc(doc(db, 'participants', participantId));

            // Mettre à jour le cache
            this.cache.participants = this.cache.participants.filter(p => p.id !== participantId);

            console.log('✅ Participant deleted from Firebase:', participantId);
        } catch (error) {
            console.error('❌ Error deleting participant:', error);
            throw error;
        }
    }

    /**
     * Obtenir toutes les classes
     */
    async getClasses() {
        await this.init();
        return this.cache.classes || [];
    }

    /**
     * Sauvegarder une classe
     */
    async saveClass(classItem) {
        await this.init();

        try {
            if (classItem.id) {
                // Mise à jour
                const docRef = doc(db, 'classes', classItem.id);
                await setDoc(docRef, classItem);

                // Mettre à jour le cache
                const index = this.cache.classes.findIndex(c => c.id === classItem.id);
                if (index !== -1) {
                    this.cache.classes[index] = classItem;
                } else {
                    this.cache.classes.push(classItem);
                }
            } else {
                // Création
                const docRef = await addDoc(collection(db, 'classes'), classItem);
                classItem.id = docRef.id;
                this.cache.classes.push(classItem);
            }

            console.log('✅ Class saved to Firebase:', classItem.id);
            return classItem;
        } catch (error) {
            console.error('❌ Error saving class:', error);
            throw error;
        }
    }

    /**
     * Supprimer une classe
     */
    async deleteClass(classId) {
        await this.init();

        try {
            await deleteDoc(doc(db, 'classes', classId));

            // Mettre à jour le cache
            this.cache.classes = this.cache.classes.filter(c => c.id !== classId);

            console.log('✅ Class deleted from Firebase:', classId);
        } catch (error) {
            console.error('❌ Error deleting class:', error);
            throw error;
        }
    }

    /**
     * Obtenir toutes les présences
     */
    async getAttendances() {
        await this.init();
        return this.cache.attendances || [];
    }

    /**
     * Sauvegarder les présences
     */
    async saveAttendances(attendances) {
        await this.init();

        try {
            // Sauvegarder chaque présence
            for (const attendance of attendances) {
                if (attendance.id) {
                    const docRef = doc(db, 'attendances', attendance.id);
                    await setDoc(docRef, attendance);
                } else {
                    const docRef = await addDoc(collection(db, 'attendances'), attendance);
                    attendance.id = docRef.id;
                }
            }

            // Mettre à jour le cache
            this.cache.attendances = attendances;

            console.log('✅ Attendances saved to Firebase');
        } catch (error) {
            console.error('❌ Error saving attendances:', error);
            throw error;
        }
    }
}

// Créer une instance globale
window.firebaseStorage = new FirebaseStorageAdapter();

console.log('🔥 Firebase Storage Adapter loaded');
