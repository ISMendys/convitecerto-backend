const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const Guest = require('../models/Guest');
const Event = require('../models/Event');
const Invite = require('../models/Invite');
const RsvpHistory = require('../models/RsvpHistory');

// @route   GET api/guests
// @desc    Get all guests
// @access  Private
router.get('/', auth, async (req, res) => {
  try {
    const guests = await Guest.find({ user: req.user.id });
    res.json(guests);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Erro no servidor');
  }
});

// @route   GET api/guests/event/:eventId
// @desc    Get all guests for an event
// @access  Private
router.get('/event/:eventId', auth, async (req, res) => {
  try {
    const event = await Event.findById(req.params.eventId);
    
    if (!event) {
      return res.status(404).json({ error: 'Evento não encontrado' });
    }
    
    // Verificar se o evento pertence ao usuário
    if (event.user.toString() !== req.user.id) {
      return res.status(401).json({ error: 'Não autorizado' });
    }
    
    const guests = await Guest.find({ eventId: req.params.eventId });
    res.json(guests);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Erro no servidor');
  }
});

// @route   GET api/guests/:id
// @desc    Get guest by ID
// @access  Public (para permitir acesso pela página de RSVP)
router.get('/:id', async (req, res) => {
  try {
    const guest = await Guest.findById(req.params.id);
    
    if (!guest) {
      return res.status(404).json({ error: 'Convidado não encontrado' });
    }
    
    res.json(guest);
  } catch (err) {
    console.error(err.message);
    
    if (err.kind === 'ObjectId') {
      return res.status(404).json({ error: 'Convidado não encontrado' });
    }
    
    res.status(500).send('Erro no servidor');
  }
});

// @route   POST api/guests
// @desc    Create a guest
// @access  Private
router.post('/', auth, async (req, res) => {
  try {
    const { name, email, phone, whatsapp, status, plusOne, plusOneName, notes, group, imageUrl, eventId, inviteId } = req.body;
    
    // Verificar se o evento existe e pertence ao usuário
    const event = await Event.findById(eventId);
    
    if (!event) {
      return res.status(404).json({ error: 'Evento não encontrado' });
    }
    
    if (event.user.toString() !== req.user.id) {
      return res.status(401).json({ error: 'Não autorizado' });
    }
    
    // Verificar se o convite existe e pertence ao evento (se fornecido)
    if (inviteId) {
      const invite = await Invite.findById(inviteId);
      
      if (!invite) {
        return res.status(404).json({ error: 'Convite não encontrado' });
      }
      
      if (invite.eventId.toString() !== eventId) {
        return res.status(400).json({ error: 'O convite não pertence a este evento' });
      }
    }
    
    // Criar novo convidado
    const newGuest = new Guest({
      name,
      email,
      phone,
      whatsapp,
      status,
      plusOne,
      plusOneName,
      notes,
      group,
      imageUrl,
      eventId,
      inviteId,
      user: req.user.id
    });
    
    const guest = await newGuest.save();
    
    // Criar registro inicial no histórico de RSVP
    const newRsvpHistory = new RsvpHistory({
      guestId: guest._id,
      status,
      message: 'Convidado criado',
      timestamp: Date.now()
    });
    
    await newRsvpHistory.save();
    
    res.json(guest);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Erro no servidor');
  }
});

// @route   PUT api/guests/:id
// @desc    Update a guest
// @access  Private
router.put('/:id', auth, async (req, res) => {
  try {
    const { name, email, phone, whatsapp, status, plusOne, plusOneName, notes, group, imageUrl, inviteId } = req.body;
    
    // Verificar se o convidado existe
    let guest = await Guest.findById(req.params.id);
    
    if (!guest) {
      return res.status(404).json({ error: 'Convidado não encontrado' });
    }
    
    // Verificar se o evento pertence ao usuário
    const event = await Event.findById(guest.eventId);
    
    if (!event) {
      return res.status(404).json({ error: 'Evento não encontrado' });
    }
    
    if (event.user.toString() !== req.user.id) {
      return res.status(401).json({ error: 'Não autorizado' });
    }
    
    // Verificar se o convite existe e pertence ao evento (se fornecido)
    if (inviteId) {
      const invite = await Invite.findById(inviteId);
      
      if (!invite) {
        return res.status(404).json({ error: 'Convite não encontrado' });
      }
      
      if (invite.eventId.toString() !== guest.eventId.toString()) {
        return res.status(400).json({ error: 'O convite não pertence a este evento' });
      }
    }
    
    // Verificar se o status mudou
    const statusChanged = status && status !== guest.status;
    
    // Atualizar convidado
    guest = await Guest.findByIdAndUpdate(
      req.params.id,
      { 
        name: name || guest.name,
        email: email !== undefined ? email : guest.email,
        phone: phone !== undefined ? phone : guest.phone,
        whatsapp: whatsapp !== undefined ? whatsapp : guest.whatsapp,
        status: status || guest.status,
        plusOne: plusOne !== undefined ? plusOne : guest.plusOne,
        plusOneName: plusOneName !== undefined ? plusOneName : guest.plusOneName,
        notes: notes !== undefined ? notes : guest.notes,
        group: group || guest.group,
        imageUrl: imageUrl !== undefined ? imageUrl : guest.imageUrl,
        inviteId: inviteId !== undefined ? inviteId : guest.inviteId
      },
      { new: true }
    );
    
    // Se o status mudou, criar um novo registro no histórico de RSVP
    if (statusChanged) {
      const newRsvpHistory = new RsvpHistory({
        guestId: guest._id,
        status,
        message: 'Status atualizado pelo organizador',
        timestamp: Date.now()
      });
      
      await newRsvpHistory.save();
    }
    
    res.json(guest);
  } catch (err) {
    console.error(err.message);
    
    if (err.kind === 'ObjectId') {
      return res.status(404).json({ error: 'Convidado não encontrado' });
    }
    
    res.status(500).send('Erro no servidor');
  }
});

// @route   DELETE api/guests/:id
// @desc    Delete a guest
// @access  Private
router.delete('/:id', auth, async (req, res) => {
  try {
    // Verificar se o convidado existe
    const guest = await Guest.findById(req.params.id);
    
    if (!guest) {
      return res.status(404).json({ error: 'Convidado não encontrado' });
    }
    
    // Verificar se o evento pertence ao usuário
    const event = await Event.findById(guest.eventId);
    
    if (!event) {
      return res.status(404).json({ error: 'Evento não encontrado' });
    }
    
    if (event.user.toString() !== req.user.id) {
      return res.status(401).json({ error: 'Não autorizado' });
    }
    
    // Excluir convidado
    await Guest.findByIdAndRemove(req.params.id);
    
    // Excluir histórico de RSVP
    await RsvpHistory.deleteMany({ guestId: req.params.id });
    
    res.json({ msg: 'Convidado removido' });
  } catch (err) {
    console.error(err.message);
    
    if (err.kind === 'ObjectId') {
      return res.status(404).json({ error: 'Convidado não encontrado' });
    }
    
    res.status(500).send('Erro no servidor');
  }
});

// @route   PUT api/guests/:id/status
// @desc    Update guest status (RSVP)
// @access  Public (para permitir acesso pela página de RSVP)
router.put('/:id/status', async (req, res) => {
  try {
    const { status, message } = req.body;
    
    // Verificar se o convidado existe
    let guest = await Guest.findById(req.params.id);
    
    if (!guest) {
      return res.status(404).json({ error: 'Convidado não encontrado' });
    }
    
    // Atualizar status do convidado
    guest = await Guest.findByIdAndUpdate(
      req.params.id,
      { status },
      { new: true }
    );
    
    // Criar novo registro no histórico de RSVP
    const newRsvpHistory = new RsvpHistory({
      guestId: guest._id,
      status,
      message: message || 'Status atualizado pelo convidado',
      timestamp: Date.now()
    });
    
    await newRsvpHistory.save();
    
    res.json(guest);
  } catch (err) {
    console.error(err.message);
    
    if (err.kind === 'ObjectId') {
      return res.status(404).json({ error: 'Convidado não encontrado' });
    }
    
    res.status(500).send('Erro no servidor');
  }
});

// @route   GET api/guests/:id/rsvp-history
// @desc    Get RSVP history for a guest
// @access  Private
router.get('/:id/rsvp-history', auth, async (req, res) => {
  try {
    // Verificar se o convidado existe
    const guest = await Guest.findById(req.params.id);
    
    if (!guest) {
      return res.status(404).json({ error: 'Convidado não encontrado' });
    }
    
    // Verificar se o evento pertence ao usuário
    const event = await Event.findById(guest.eventId);
    
    if (!event) {
      return res.status(404).json({ error: 'Evento não encontrado' });
    }
    
    if (event.user.toString() !== req.user.id) {
      return res.status(401).json({ error: 'Não autorizado' });
    }
    
    // Buscar histórico de RSVP
    const rsvpHistory = await RsvpHistory.find({ guestId: req.params.id }).sort({ timestamp: -1 });
    
    res.json(rsvpHistory);
  } catch (err) {
    console.error(err.message);
    
    if (err.kind === 'ObjectId') {
      return res.status(404).json({ error: 'Convidado não encontrado' });
    }
    
    res.status(500).send('Erro no servidor');
  }
});

// @route   POST api/guests/link-invite
// @desc    Link multiple guests to an invite
// @access  Private
router.post('/link-invite', auth, async (req, res) => {
  try {
    const { inviteId, guestIds } = req.body;
    
    if (!inviteId || !guestIds || !Array.isArray(guestIds) || guestIds.length === 0) {
      return res.status(400).json({ error: 'Dados inválidos' });
    }
    
    // Verificar se o convite existe
    const invite = await Invite.findById(inviteId);
    
    if (!invite) {
      return res.status(404).json({ error: 'Convite não encontrado' });
    }
    
    // Verificar se o evento pertence ao usuário
    const event = await Event.findById(invite.eventId);
    
    if (!event) {
      return res.status(404).json({ error: 'Evento não encontrado' });
    }
    
    if (event.user.toString() !== req.user.id) {
      return res.status(401).json({ error: 'Não autorizado' });
    }
    
    // Atualizar cada convidado
    const updatedGuests = [];
    
    for (const guestId of guestIds) {
      // Verificar se o convidado existe
      const guest = await Guest.findById(guestId);
      
      if (!guest) {
        continue; // Pular convidados que não existem
      }
      
      // Verificar se o convidado pertence ao mesmo evento que o convite
      if (guest.eventId.toString() !== invite.eventId.toString()) {
        continue; // Pular convidados de outros eventos
      }
      
      // Atualizar convidado
      const updatedGuest = await Guest.findByIdAndUpdate(
        guestId,
        { inviteId },
        { new: true }
      );
      
      updatedGuests.push(updatedGuest);
    }
    
    res.json({
      message: `${updatedGuests.length} convidados vinculados ao convite com sucesso`,
      guests: updatedGuests
    });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Erro no servidor');
  }
});

module.exports = router;
