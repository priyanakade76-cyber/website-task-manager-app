const jwt = require('jsonwebtoken');
const { supabase } = require('../config/supabase');
const { formatUser } = require('../utils/formatters');

const protect = async (req, res, next) => {
  let token;

  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer')
  ) {
    token = req.headers.authorization.split(' ')[1];
  }

  if (!token) {
    return res.status(401).json({
      success: false,
      message: 'Not authorized to access this route, token missing'
    });
  }

  try {
    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET || 'secret_jwt_key_task_manager'
    );

    const { data: user, error } = await supabase
      .from('users')
      .select('id, name, email, profile_image, theme, notification_settings, created_at, updated_at')
      .eq('id', decoded.id)
      .maybeSingle();

    if (error || !user) {
      return res.status(401).json({
        success: false,
        message: 'The user belonging to this token no longer exists'
      });
    }

    req.user = formatUser(user);
    next();
  } catch (err) {
    return res.status(401).json({
      success: false,
      message: 'Not authorized to access this route, invalid or expired token'
    });
  }
};

module.exports = { protect };
