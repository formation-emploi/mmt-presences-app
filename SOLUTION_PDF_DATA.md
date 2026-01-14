# 🔧 SOLUTION : Extraction des données PDF au lieu de sauvegarde du PDF

## 🎯 OBJECTIF

Au lieu de sauvegarder le PDF original complet (qui ne peut pas être synchronisé via Firestore), on va :
1. **Extraire toutes les données** des champs PDF lors de l'import
2. **Sauvegarder uniquement les données texte** dans Firestore
3. **Utiliser le template vierge** pour régénérer les PDFs

---

## 📋 CHAMPS À EXTRAIRE

### Champs actuellement mappés :
- `Textfeld 98` - Mois/Année
- `Textfeld 103` - Date actuelle
- `5.19` - Lieu
- `1.172` - Commentaires
- `Optionsfeld 6` - Type de présence
- `Optionsfeld 70` - Interruption
- `1.63` - Date d'interruption
- 62 champs de présence (2.10146, 2.10147, etc.)

### Champs à ajouter (données participant) :
- **Nom** : `1.1` ou similaire
- **Prénom** : `1.2` ou similaire  
- **Date de naissance** : `1.3` ou similaire
- **Adresse** : `1.4` ou similaire
- **Numéro AVS** : `1.5` ou similaire
- **Dates du cours** : `1.6` et `1.7` ou similaire
- **Titre de la MMT** : `1.68` ou similaire
- **Etc.**

---

## 🔧 MODIFICATIONS NÉCESSAIRES

### 1. Modifier `parsePDF()` pour extraire TOUS les champs

**Actuellement** : On extrait seulement quelques champs (nom, prénom, dates)

**À faire** : Extraire TOUS les champs du formulaire et les sauvegarder dans `participant.pdfData`

```javascript
async function parsePDF(file) {
    const arrayBuffer = await file.arrayBuffer();
    const pdfDoc = await PDFLib.PDFDocument.load(arrayBuffer);
    const form = pdfDoc.getForm();
    
    // Extraire TOUS les champs
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
    
    return {
        firstName: pdfData['1.2'] || '',  // Ajuster selon le vrai champ
        lastName: pdfData['1.1'] || '',   // Ajuster selon le vrai champ
        // ... autres champs
        pdfData: pdfData  // NOUVEAU : Toutes les données du PDF
    };
}
```

### 2. Modifier `generatePDF()` pour utiliser `pdfData`

**Actuellement** : On charge le PDF original du participant

**À faire** : Utiliser le template vierge + `participant.pdfData`

```javascript
async function generatePDF(participant, attendanceData, templateBytes, signatureDate, isCorrection, signatureId) {
    const pdfDoc = await PDFLib.PDFDocument.load(templateBytes);
    const form = pdfDoc.getForm();
    
    // Remplir TOUS les champs depuis participant.pdfData
    if (participant.pdfData) {
        Object.keys(participant.pdfData).forEach(fieldName => {
            try {
                const field = form.getField(fieldName);
                const value = participant.pdfData[fieldName];
                
                if (field instanceof PDFLib.PDFTextField) {
                    field.setText(value);
                } else if (field instanceof PDFLib.PDFCheckBox) {
                    if (value) field.check();
                } else if (field instanceof PDFLib.PDFRadioGroup) {
                    if (value) field.select(value);
                }
            } catch (e) {
                // Champ introuvable, ignorer
            }
        });
    }
    
    // Puis ajouter les présences, signature, etc.
    // ... (code existant)
}
```

### 3. Supprimer `originalPdf` complètement

- Ne plus sauvegarder `originalPdf` dans les participants
- Ne plus le nettoyer avant Firestore (plus besoin)
- Tout sera dans `pdfData` (synchronisable)

---

## ✅ AVANTAGES

1. **Synchronisation Firestore** ✅ - Les données texte sont synchronisables
2. **Taille réduite** ✅ - Quelques Ko au lieu de plusieurs Mo
3. **Flexibilité** ✅ - On peut changer le template PDF facilement
4. **Pas de limite** ✅ - Firestore supporte les objets JSON

---

## ⚠️ TRAVAIL À FAIRE

1. **Identifier tous les champs** du formulaire PDF (noms exacts)
2. **Modifier `parsePDF()`** pour extraire tous les champs
3. **Modifier `generatePDF()`** pour utiliser `pdfData`
4. **Tester** avec un participant
5. **Supprimer** `originalPdf` du code

---

## 🚀 PROCHAINES ÉTAPES

**Voulez-vous que je fasse ces modifications maintenant ?**

Cela va prendre un peu de temps mais c'est la meilleure solution à long terme.

---

*Document créé le : 14/01/2026 à 12:26*  
*Pour : Paul Schaffner*
