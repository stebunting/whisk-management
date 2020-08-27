$(() => {
  // Add datepicker objects
  $('input[form-validation-type="date"]').datepicker({
    format: 'yyyy-mm-dd',
    autoclose: true,
    weekStart: 1,
  });
});
