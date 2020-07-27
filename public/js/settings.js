$(() => {
  $(`#settingsTabs a[href="${window.location.hash}"]`).tab('show');
})