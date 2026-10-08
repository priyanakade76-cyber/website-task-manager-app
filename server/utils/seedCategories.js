const { supabase } = require('../config/supabase');

const DEFAULT_CATEGORIES = [
  { name: 'Work', color: '#3b82f6', icon: 'fa-briefcase', isDefault: true },
  { name: 'Personal', color: '#10b981', icon: 'fa-user', isDefault: true },
  { name: 'Study', color: '#8b5cf6', icon: 'fa-graduation-cap', isDefault: true },
  { name: 'Projects', color: '#f59e0b', icon: 'fa-diagram-project', isDefault: true },
  { name: 'Shopping', color: '#ec4899', icon: 'fa-cart-shopping', isDefault: true },
  { name: 'Fitness', color: '#06b6d4', icon: 'fa-dumbbell', isDefault: true }
];

const seedDefaultCategories = async (userId) => {
  try {
    const { data: existing, error } = await supabase
      .from('categories')
      .select('id')
      .eq('user_id', userId);

    if (error) {
      console.error('[Supabase] Error checking categories to seed:', error.message);
      return;
    }

    if (!existing || existing.length === 0) {
      const docs = DEFAULT_CATEGORIES.map((c) => ({
        user_id: userId,
        name: c.name,
        color: c.color,
        icon: c.icon,
        is_default: true
      }));

      const { error: insertError } = await supabase.from('categories').insert(docs);
      if (insertError) {
        console.error('[Supabase] Error inserting default categories:', insertError.message);
      }
    }
  } catch (err) {
    console.error('[Supabase] Error seeding default categories:', err.message);
  }
};

module.exports = { seedDefaultCategories, DEFAULT_CATEGORIES };
