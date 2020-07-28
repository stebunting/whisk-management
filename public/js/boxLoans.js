$(function() {
    
    // Fade out alert flashing
    setTimeout(function(){
        $('#flash').fadeOut(1000); }, 3000);
	
	// Add datepicker objects
	$("input[form-validation-type='date']").each(function() {
		$(this).datepicker({
			format: 'yyyy-mm-dd',
			autoclose: true,
			weekStart: 1,
		});
	});
})