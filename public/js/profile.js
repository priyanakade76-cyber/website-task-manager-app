/**
 * User Profile Management, Theme Switch, Avatar Picker & Password Updates
 */

document.addEventListener('DOMContentLoaded', () => {
  if (API.isAuthenticated()) {
    initProfilePage();
  }
});

async function initProfilePage() {
  await loadUserProfile();
  bindProfileForms();
}

async function loadUserProfile() {
  try {
    const res = await API.auth.getMe();
    const user = res.data;

    document.getElementById('profile-input-name').value = user.name || '';
    document.getElementById('profile-input-email').value = user.email || '';

    // Avatar preview
    renderAvatarPreview(user.profileImage, user.name);

    // Theme selector
    const currentTheme = user.theme || localStorage.getItem('taskmanager_theme') || 'dark';
    const themeSelect = document.getElementById('profile-select-theme');
    if (themeSelect) themeSelect.value = currentTheme;

    // Notification settings
    if (user.notificationSettings) {
      const emailCheck = document.getElementById('setting-email-alerts');
      const browserCheck = document.getElementById('setting-browser-alerts');
      if (emailCheck) emailCheck.checked = !!user.notificationSettings.emailAlerts;
      if (browserCheck) browserCheck.checked = !!user.notificationSettings.browserAlerts;
    }

    // Account creation date
    const memberSinceEl = document.getElementById('profile-member-since');
    if (memberSinceEl && user.createdAt) {
      memberSinceEl.textContent = new Date(user.createdAt).toLocaleDateString('en-US', {
        month: 'long',
        year: 'numeric'
      });
    }
  } catch (err) {
    showToast('Error', 'Failed to load profile', 'error');
  }
}

function renderAvatarPreview(imageSrc, name) {
  const container = document.getElementById('profile-avatar-display');
  if (!container) return;

  if (imageSrc) {
    container.innerHTML = `<img src="${imageSrc}" style="width: 100%; height: 100%; object-fit: cover; border-radius: 50%;" alt="${name}" />`;
  } else {
    const initial = (name || 'U').charAt(0).toUpperCase();
    container.innerHTML = `<span style="font-size: 2rem; font-weight: 700; color: #fff;">${initial}</span>`;
  }
}

function bindProfileForms() {
  const profileForm = document.getElementById('form-update-profile');
  const passwordForm = document.getElementById('form-change-password');
  const avatarPresets = document.querySelectorAll('.avatar-preset-btn');
  let selectedAvatar = '';

  // Avatar preset buttons
  avatarPresets.forEach((btn) => {
    btn.addEventListener('click', () => {
      avatarPresets.forEach((b) => b.classList.remove('selected'));
      btn.classList.add('selected');
      selectedAvatar = btn.dataset.avatarUrl;
      const userName = document.getElementById('profile-input-name').value;
      renderAvatarPreview(selectedAvatar, userName);
    });
  });

  // Profile Form
  if (profileForm) {
    profileForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const name = document.getElementById('profile-input-name').value;
      const email = document.getElementById('profile-input-email').value;
      const theme = document.getElementById('profile-select-theme').value;
      const emailAlerts = document.getElementById('setting-email-alerts').checked;
      const browserAlerts = document.getElementById('setting-browser-alerts').checked;

      const payload = {
        name,
        email,
        theme,
        notificationSettings: {
          emailAlerts,
          browserAlerts
        }
      };

      if (selectedAvatar) {
        payload.profileImage = selectedAvatar;
      }

      try {
        await API.auth.updateProfile(payload);
        // Apply theme immediately
        document.documentElement.setAttribute('data-theme', theme);
        localStorage.setItem('taskmanager_theme', theme);

        showToast('Profile Updated', 'Changes saved successfully', 'success');
        // Refresh UI
        initUserUI();
      } catch (err) {
        showToast('Error', err.message, 'error');
      }
    });
  }

  // Password Form
  if (passwordForm) {
    passwordForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const currentPassword = document.getElementById('pwd-current').value;
      const newPassword = document.getElementById('pwd-new').value;
      const confirmPassword = document.getElementById('pwd-confirm').value;

      if (newPassword !== confirmPassword) {
        showToast('Validation Error', 'New passwords do not match', 'error');
        return;
      }

      if (newPassword.length < 6) {
        showToast('Validation Error', 'Password must be at least 6 characters', 'error');
        return;
      }

      try {
        await API.auth.changePassword(currentPassword, newPassword);
        showToast('Password Changed', 'Your password was updated successfully', 'success');
        passwordForm.reset();
      } catch (err) {
        showToast('Error', err.message, 'error');
      }
    });
  }
}
