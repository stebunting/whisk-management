$(() => {
  // Add datepicker objects
  $("input[form-validation-type='date']").each(function callback() {
    $(this).datepicker({
      format: 'yyyy-mm-dd',
      autoclose: true,
      weekStart: 1,
    });
  });
});
