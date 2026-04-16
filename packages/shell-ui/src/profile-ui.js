export function renderProfileControls({ documentObject = globalThis.document, elements, viewModel }) {
  const currentValue = elements.profileSelect.value;
  const profiles = viewModel.profiles || [];

  elements.profileSelect.replaceChildren();

  const placeholder = documentObject.createElement('option');
  placeholder.value = '';
  placeholder.textContent = profiles.length > 0 ? 'Select a profile' : 'No saved profiles';
  elements.profileSelect.appendChild(placeholder);

  for (const profile of profiles) {
    const option = documentObject.createElement('option');
    option.value = profile.id;
    option.textContent = profile.name;
    if (profile.id === viewModel.activeProfileId) {
      option.selected = true;
    }
    elements.profileSelect.appendChild(option);
  }

  if (!viewModel.activeProfileId && currentValue) {
    elements.profileSelect.value = currentValue;
  }

  const hasProfiles = profiles.length > 0;
  const hasSelectedProfile = Boolean(elements.profileSelect.value);

  elements.profileSelect.disabled = !hasProfiles;
  elements.loadProfileBtn.disabled = !hasSelectedProfile;
  elements.deleteProfileBtn.disabled = !hasSelectedProfile;
}
