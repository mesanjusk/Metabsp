const router = require('express').Router();
const { protect } = require('../middleware/auth');
const WhatsAppBlast = require('../models/WhatsAppBlast');

router.post('/', protect, async (req, res) => {
  try {
    const blast = await WhatsAppBlast.create(req.body);
    res.status(201).json(blast);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.get('/', protect, async (req, res) => {
  try {
    const blasts = await WhatsAppBlast.find({}, '-recipients')
      .sort({ createdAt: -1 })
      .limit(100)
      .lean();
    res.json(blasts);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.get('/:id', protect, async (req, res) => {
  try {
    const blast = await WhatsAppBlast.findById(req.params.id).lean();
    if (!blast) return res.status(404).json({ message: 'Not found' });
    res.json(blast);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.patch('/:id', protect, async (req, res) => {
  try {
    const blast = await WhatsAppBlast.findByIdAndUpdate(
      req.params.id,
      { $set: req.body },
      { new: true, runValidators: true }
    );
    if (!blast) return res.status(404).json({ message: 'Not found' });
    res.json(blast);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
