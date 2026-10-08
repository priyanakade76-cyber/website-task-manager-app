const { supabase } = require('../config/supabase');
const { seedDefaultCategories } = require('../utils/seedCategories');
const { formatCategory } = require('../utils/formatters');

// @desc    Get all categories for current user
// @route   GET /api/categories
// @access  Private
const getCategories = async (req, res, next) => {
  try {
    let { data: categories, error } = await supabase
      .from('categories')
      .select('*')
      .eq('user_id', req.user.id)
      .order('created_at', { ascending: true });

    if (error) {
      return next(error);
    }

    if (!categories || categories.length === 0) {
      await seedDefaultCategories(req.user.id);
      const resAfterSeed = await supabase
        .from('categories')
        .select('*')
        .eq('user_id', req.user.id)
        .order('created_at', { ascending: true });
      categories = resAfterSeed.data || [];
    }

    // Attach task count per category
    const { data: activeTasks } = await supabase
      .from('tasks')
      .select('category_id')
      .eq('user_id', req.user.id)
      .eq('is_archived', false);

    const countMap = {};
    if (activeTasks) {
      activeTasks.forEach((t) => {
        if (t.category_id) {
          countMap[t.category_id] = (countMap[t.category_id] || 0) + 1;
        }
      });
    }

    const categoriesWithCount = categories.map((cat) => {
      return formatCategory({
        ...cat,
        taskCount: countMap[cat.id] || 0
      });
    });

    res.status(200).json({
      success: true,
      count: categoriesWithCount.length,
      data: categoriesWithCount
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Create a new category
// @route   POST /api/categories
// @access  Private
const createCategory = async (req, res, next) => {
  try {
    const { name, color, icon } = req.body;

    if (!name || name.trim() === '') {
      return res.status(400).json({
        success: false,
        message: 'Category name is required'
      });
    }

    const trimmedName = name.trim();

    // Check for existing duplicate name for this user
    const { data: existing } = await supabase
      .from('categories')
      .select('id')
      .eq('user_id', req.user.id)
      .ilike('name', trimmedName)
      .maybeSingle();

    if (existing) {
      return res.status(400).json({
        success: false,
        message: 'A category with this name already exists'
      });
    }

    const { data: category, error } = await supabase
      .from('categories')
      .insert({
        user_id: req.user.id,
        name: trimmedName,
        color: color || '#6366f1',
        icon: icon || 'fa-folder',
        is_default: false
      })
      .select()
      .single();

    if (error) {
      return next(error);
    }

    res.status(201).json({
      success: true,
      message: 'Category created successfully',
      data: formatCategory(category)
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Update category
// @route   PUT /api/categories/:id
// @access  Private
const updateCategory = async (req, res, next) => {
  try {
    const { name, color, icon } = req.body;

    const { data: category, error: findError } = await supabase
      .from('categories')
      .select('*')
      .eq('id', req.params.id)
      .eq('user_id', req.user.id)
      .maybeSingle();

    if (findError || !category) {
      return res.status(404).json({
        success: false,
        message: 'Category not found'
      });
    }

    const updates = {};
    if (name) updates.name = name.trim();
    if (color) updates.color = color;
    if (icon) updates.icon = icon;

    const { data: updatedCat, error: updateError } = await supabase
      .from('categories')
      .update(updates)
      .eq('id', req.params.id)
      .eq('user_id', req.user.id)
      .select()
      .single();

    if (updateError) {
      return next(updateError);
    }

    // Also update cached category info in related tasks
    const taskUpdates = {};
    if (updates.name) taskUpdates.category_name = updates.name;
    if (updates.color) taskUpdates.category_color = updates.color;

    if (Object.keys(taskUpdates).length > 0) {
      await supabase
        .from('tasks')
        .update(taskUpdates)
        .eq('user_id', req.user.id)
        .eq('category_id', req.params.id);
    }

    res.status(200).json({
      success: true,
      message: 'Category updated successfully',
      data: formatCategory(updatedCat)
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Delete category
// @route   DELETE /api/categories/:id
// @access  Private
const deleteCategory = async (req, res, next) => {
  try {
    const { data: category, error: findError } = await supabase
      .from('categories')
      .select('*')
      .eq('id', req.params.id)
      .eq('user_id', req.user.id)
      .maybeSingle();

    if (findError || !category) {
      return res.status(404).json({
        success: false,
        message: 'Category not found'
      });
    }

    // Set tasks with this category to General
    await supabase
      .from('tasks')
      .update({
        category_id: null,
        category_name: 'General',
        category_color: '#6366f1'
      })
      .eq('user_id', req.user.id)
      .eq('category_id', req.params.id);

    const { error: deleteError } = await supabase
      .from('categories')
      .delete()
      .eq('id', req.params.id)
      .eq('user_id', req.user.id);

    if (deleteError) {
      return next(deleteError);
    }

    res.status(200).json({
      success: true,
      message: 'Category deleted successfully'
    });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getCategories,
  createCategory,
  updateCategory,
  deleteCategory
};
