$(() => {
  $(`#settingsTabs a[href="${window.location.hash}"]`).tab('show');

  // Add datepicker objects
  // $('#timeframe-delivery-time, #timeframe-deadline-time, #timeframe-vegetable-deadline-time')
  //   .each(function callback() {
  //     $(this).datetimepicker();
  //   });
});
