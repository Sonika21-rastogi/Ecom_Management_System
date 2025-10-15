const Joi = require('joi');
const jwt = require('jsonwebtoken');
const { User } = require('../models');

const registerSchema = Joi.object({ name: Joi.string().required(), email: Joi.string().email().required(), password: Joi.string().min(6).required(), role: Joi.string().valid('USER','ADMIN').default('USER') });
const loginSchema = Joi.object({ email: Joi.string().email().required(), password: Joi.string().required() });

exports.register = async (req, res, next) => {
  try {
    const { error, value } = registerSchema.validate(req.body);
    if (error) return res.status(400).json({ error: error.message });
    const existing = await User.findOne({ where: { email: value.email } });
    if (existing) return res.status(400).json({ error: 'Email already in use' });
    // If user requested ADMIN role, require admin creation secret
    if (value.role === 'ADMIN') {
      const secretHeader = req.headers['x-admin-secret'] || req.body.adminSecret;
      const expected = process.env.ADMIN_CREATION_SECRET || '';
      if (!expected || !secretHeader || secretHeader !== expected) {
        return res.status(403).json({ error: 'Admin creation not allowed' });
      }
    }

    const userData = { name: value.name, email: value.email, password: value.password, role: value.role };
    const user = await User.create(userData);
    res.status(201).json({ id: user.id, email: user.email, name: user.name });
  } catch (err) { next(err); }
};

exports.login = async (req, res, next) => {
  try {
    const { error, value } = loginSchema.validate(req.body);
    if (error) return res.status(400).json({ error: error.message });
    const user = await User.findOne({ where: { email: value.email } });
    if (!user) return res.status(400).json({ error: 'Invalid credentials' });
    const ok = await user.comparePassword(value.password);
    if (!ok) return res.status(400).json({ error: 'Invalid credentials' });
    const token = jwt.sign({ id: user.id, role: user.role }, process.env.JWT_SECRET || 'changeme', { expiresIn: '7d' });
    res.json({ token });
  } catch (err) { next(err); }
};
