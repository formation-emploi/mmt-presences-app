/**
 * Firebase Service - Gestion des données et authentification
 * Remplace localStorage par Firebase Firestore
 */

// Configuration Firebase
const firebaseConfig = {
    apiKey: "AIzaSyC9Jp7YGeYxYja5rIRXSdVQFvVMmiMU7Ko",
    authDomain: "mmt-presences-app.firebaseapp.com",
    projectId: "mmt-presences-app",
    storageBucket: "mmt-presences-app.firebasestorage.app",
    messagingSenderId: "859089098904",
    appId: "1:859089098904:web:4dc75d1d2813509278d8ed"
};

// Import Firebase modules (via CDN)
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js';
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';
import { getFirestore, collection, doc, getDoc, getDocs, setDoc, addDoc, updateDoc, deleteDoc, query, where, onSnapshot } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

class FirebaseService {
    constructor() {
        this.currentUser = null;
        this.unsubscribers = [];

        // Écouter les changements d'authentification
        onAuthStateChanged(auth, (user) => {
            this.currentUser = user;
            if (user) {
                console.log('Utilisateur connecté:', user.email);
                this.onUserLoggedIn();
            } else {
                console.log('Utilisateur déconnecté');
                this.onUserLoggedOut();
            }
        });
    }

    // ========================================
    // AUTHENTIFICATION
    // ========================================

    /**
     * Connexion avec email/password
     */
    async login(email, password) {
        try {
            const userCredential = await signInWithEmailAndPassword(auth, email, password);
            return { success: true, user: userCredential.user };
        } catch (error) {
            console.error('Erreur de connexion:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Inscription (création de compte)
     */
    async register(email, password) {
        try {
            const userCredential = await createUserWithEmailAndPassword(auth, email, password);
            return { success: true, user: userCredential.user };
        } catch (error) {
            console.error('Erreur d\'inscription:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Déconnexion
     */
    async logout() {
        try {
            await signOut(auth);
            // Nettoyer les listeners
            this.unsubscribers.forEach(unsub => unsub());
            this.unsubscribers = [];
            return { success: true };
        } catch (error) {
            console.error('Erreur de déconnexion:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Vérifier si l'utilisateur est connecté
     */
    isLoggedIn() {
        return this.currentUser !== null;
    }

    /**
     * Obtenir l'utilisateur actuel
     */
    getCurrentUser() {
        return this.currentUser;
    }

    // ========================================
    // GESTION DES PARTICIPANTS
    // ========================================

    /**
     * Récupérer tous les participants
     */
    async getParticipants() {
        try {
            const querySnapshot = await getDocs(collection(db, 'participants'));
            const participants = [];
            querySnapshot.forEach((doc) => {
                participants.push({ id: doc.id, ...doc.data() });
            });
            return participants;
        } catch (error) {
            console.error('Erreur lors de la récupération des participants:', error);
            return [];
        }
    }

    /**
     * Écouter les changements en temps réel des participants
     */
    onParticipantsChange(callback) {
        const unsubscribe = onSnapshot(collection(db, 'participants'), (snapshot) => {
            const participants = [];
            snapshot.forEach((doc) => {
                participants.push({ id: doc.id, ...doc.data() });
            });
            callback(participants);
        });
        this.unsubscribers.push(unsubscribe);
        return unsubscribe;
    }

    /**
     * Sauvegarder un participant
     */
    async saveParticipant(participant) {
        try {
            if (participant.id) {
                // Mise à jour
                const participantRef = doc(db, 'participants', participant.id);
                await updateDoc(participantRef, participant);
            } else {
                // Création
                const docRef = await addDoc(collection(db, 'participants'), participant);
                participant.id = docRef.id;
            }
            return { success: true, participant };
        } catch (error) {
            console.error('Erreur lors de la sauvegarde du participant:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Supprimer un participant
     */
    async deleteParticipant(participantId) {
        try {
            await deleteDoc(doc(db, 'participants', participantId));
            return { success: true };
        } catch (error) {
            console.error('Erreur lors de la suppression du participant:', error);
            return { success: false, error: error.message };
        }
    }

    // ========================================
    // GESTION DES CLASSES
    // ========================================

    /**
     * Récupérer toutes les classes
     */
    async getClasses() {
        try {
            const querySnapshot = await getDocs(collection(db, 'classes'));
            const classes = [];
            querySnapshot.forEach((doc) => {
                classes.push({ id: doc.id, ...doc.data() });
            });
            return classes;
        } catch (error) {
            console.error('Erreur lors de la récupération des classes:', error);
            return [];
        }
    }

    /**
     * Écouter les changements en temps réel des classes
     */
    onClassesChange(callback) {
        const unsubscribe = onSnapshot(collection(db, 'classes'), (snapshot) => {
            const classes = [];
            snapshot.forEach((doc) => {
                classes.push({ id: doc.id, ...doc.data() });
            });
            callback(classes);
        });
        this.unsubscribers.push(unsubscribe);
        return unsubscribe;
    }

    /**
     * Sauvegarder une classe
     */
    async saveClass(classItem) {
        try {
            if (classItem.id) {
                // Mise à jour
                const classRef = doc(db, 'classes', classItem.id);
                await updateDoc(classRef, classItem);
            } else {
                // Création
                const docRef = await addDoc(collection(db, 'classes'), classItem);
                classItem.id = docRef.id;
            }
            return { success: true, class: classItem };
        } catch (error) {
            console.error('Erreur lors de la sauvegarde de la classe:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Supprimer une classe
     */
    async deleteClass(classId) {
        try {
            await deleteDoc(doc(db, 'classes', classId));
            return { success: true };
        } catch (error) {
            console.error('Erreur lors de la suppression de la classe:', error);
            return { success: false, error: error.message };
        }
    }

    // ========================================
    // GESTION DES PRÉSENCES
    // ========================================

    /**
     * Récupérer les présences
     */
    async getAttendances(classId = null, date = null) {
        try {
            let q = collection(db, 'attendances');

            if (classId) {
                q = query(q, where('classId', '==', classId));
            }
            if (date) {
                q = query(q, where('date', '==', date));
            }

            const querySnapshot = await getDocs(q);
            const attendances = [];
            querySnapshot.forEach((doc) => {
                attendances.push({ id: doc.id, ...doc.data() });
            });
            return attendances;
        } catch (error) {
            console.error('Erreur lors de la récupération des présences:', error);
            return [];
        }
    }

    /**
     * Sauvegarder une présence
     */
    async saveAttendance(attendance) {
        try {
            if (attendance.id) {
                // Mise à jour
                const attendanceRef = doc(db, 'attendances', attendance.id);
                await updateDoc(attendanceRef, attendance);
            } else {
                // Création
                const docRef = await addDoc(collection(db, 'attendances'), attendance);
                attendance.id = docRef.id;
            }
            return { success: true, attendance };
        } catch (error) {
            console.error('Erreur lors de la sauvegarde de la présence:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Sauvegarder plusieurs présences en batch
     */
    async saveAttendances(attendances) {
        try {
            const promises = attendances.map(attendance => this.saveAttendance(attendance));
            await Promise.all(promises);
            return { success: true };
        } catch (error) {
            console.error('Erreur lors de la sauvegarde des présences:', error);
            return { success: false, error: error.message };
        }
    }

    // ========================================
    // CALLBACKS
    // ========================================

    onUserLoggedIn() {
        // À surcharger par l'application
        if (window.app && window.app.onUserLoggedIn) {
            window.app.onUserLoggedIn();
        }
    }

    onUserLoggedOut() {
        // À surcharger par l'application
        if (window.app && window.app.onUserLoggedOut) {
            window.app.onUserLoggedOut();
        }
    }
}

// Créer une instance globale
window.firebaseService = new FirebaseService();

console.log('Firebase Service initialisé !');
