const express = require('express');
const router = express.Router();
const externalSourceController = require('../controllers/ExternalSourceController');
const { auth } = require('../midleware/auth'); 

console.log("ExternalSource Route File Loaded");

// All routes protected by auth
router.use(auth);

router.get('/', externalSourceController.getAllSourcedItems);
router.delete('/:id', externalSourceController.deleteSourcedItem);

module.exports = router;
