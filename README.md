# 📦 Application MMT Présences - Version GitHub Pages

Application de gestion des présences MMT hébergée sur GitHub Pages avec stockage des données dans SharePoint.

---

## 🎯 Architecture

- **Frontend** : HTML/CSS/JavaScript (hébergé sur GitHub Pages)
- **Backend** : SharePoint Online (stockage des données via API REST)
- **Authentification** : Compte Microsoft (SharePoint)

---

## 📋 Prérequis

1. **Compte GitHub** (gratuit)
2. **Accès SharePoint** sur : `https://formationemploi.sharepoint.com/sites/TestapplicationMMT`
3. **Droits de création de listes** sur le site SharePoint

---

## 🚀 Installation

### Étape 1 : Créer les listes SharePoint

Sur votre site SharePoint (`https://formationemploi.sharepoint.com/sites/TestapplicationMMT`), créez les listes suivantes :

#### **Liste 1 : MMT_Participants**

Colonnes :
- `Title` (Texte) - Titre par défaut
- `Firstname` (Texte)
- `Lastname` (Texte)
- `WorkPercent` (Nombre)
- `DateStart` (Date)
- `DateEnd` (Date)
- `InterruptionMMT` (Oui/Non)
- `InterruptionDate` (Date)
- `Schedule` (Texte multiligne)

#### **Liste 2 : MMT_Classes**

Colonnes :
- `Title` (Texte) - Nom de la classe
- `Description` (Texte)
- `Participants` (Texte multiligne) - JSON des IDs participants

#### **Liste 3 : MMT_Attendances**

Colonnes :
- `Title` (Texte) - Titre par défaut
- `ClassId` (Nombre)
- `ParticipantId` (Nombre)
- `AttendanceDate` (Date)
- `AttendanceCode` (Texte)
- `Period` (Texte) - "AM" ou "PM"

---

### Étape 2 : Déployer sur GitHub Pages

1. **Créer un repository GitHub**
   - Nom : `mmt-presences-app`
   - Public ou Privé (au choix)

2. **Charger les fichiers**
   - Tous les fichiers de ce dossier

3. **Activer GitHub Pages**
   - Settings > Pages
   - Source : `main` branch
   - Folder : `/ (root)`
   - Save

4. **Accéder à l'application**
   - URL : `https://VOTRE-USERNAME.github.io/mmt-presences-app/`

---

### Étape 3 : Configuration

1. **Modifier `sharepoint-service.js`**
   
   Ligne 8, vérifiez que l'URL est correcte :
   ```javascript
   this.siteUrl = 'https://formationemploi.sharepoint.com/sites/TestapplicationMMT';
   ```

2. **Tester la connexion**
   
   Ouvrez l'application dans votre navigateur et ouvrez la console (F12).
   
   Tapez :
   ```javascript
   await spService.checkLists()
   ```
   
   Vous devriez voir : `{ success: true }`

---

## 📁 Structure des fichiers

```
MMT_App_GitHub/
├── index.html                  ← Page principale
├── style.css                   ← Styles
├── app.js                      ← Logique application
├── attendance.js               ← Gestion présences
├── pdf_generator.js            ← Génération PDF
├── pdf_parser.js               ← Parsing PDF
├── sharepoint-service.js       ← Service SharePoint (NOUVEAU)
├── logo.png                    ← Logo
├── resources/                  ← Bibliothèques PDF
└── README.md                   ← Ce fichier
```

---

## 🔧 Modifications à faire dans app.js

Pour utiliser SharePoint au lieu de localStorage, remplacez :

### **Avant (localStorage) :**
```javascript
const participants = JSON.parse(localStorage.getItem('participants') || '[]');
```

### **Après (SharePoint) :**
```javascript
const participants = await spService.getParticipants();
```

---

## ⚠️ Important - Sécurité

- ✅ Les données sont stockées dans SharePoint (conforme RGPD)
- ✅ Authentification via compte Microsoft
- ✅ Pas de données sensibles dans le code GitHub
- ⚠️ Ne jamais committer de mots de passe ou tokens

---

## 🐛 Dépannage

### Erreur CORS

Si vous voyez une erreur CORS, c'est normal. SharePoint bloque les requêtes cross-origin.

**Solution** : L'application doit être ouverte depuis SharePoint (via un iFrame ou un lien).

### Listes non trouvées

Vérifiez que :
1. Les listes existent sur SharePoint
2. Les noms sont exacts (sensible à la casse)
3. Vous avez les droits de lecture/écriture

---

## 📞 Support

**Développeur** : Paul Schaffner  
**Email** : p.schaffner@frmpl.ch  
**Date** : 11/01/2026

---

## 📝 Changelog

### Version 1.0 (11/01/2026)
- ✅ Migration vers GitHub Pages
- ✅ Intégration SharePoint REST API
- ✅ Remplacement localStorage par SharePoint
- ✅ Documentation complète

---

*Généré automatiquement le 11/01/2026*
