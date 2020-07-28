// Script to add form verification to html forms
// Form must have form-validation="true" and a unique id
// Each input must have form-validation="true" and form-validation-type="type"
// type can be number, name, email, phone, notes, password, date
// Submit button must have class form-validate

$(function() {

	function hideAllMessages() {
		$('.form-validation-invalid').each(function() {
			$(this).hide();
		});
	}

	// Function to validate input
	function validateInput(selector) {
		var value = selector.val();
		var validationType = selector.attr('form-validation-type');
		var valid = true;

		// Check that something has been entered
		if (value.length > 0) {

			// Check for valid number
			if (validationType == 'number') {
				var reg = /[^0-9]/;
				valid = !reg.test(value)

			// Check for valid name
			} else if (validationType == 'name') {
				var reg = /[^a-zA-ZåäöÅÄÖ\ \-]/;
				valid = !reg.test(value)

			// Check for valid e-mail address
			} else if (validationType == 'email') {
				// Ensure @ followed by .
				emailSplit = value.split('@');
				if (emailSplit.length < 2) {
					valid = false;
				} else {
					domainSplit = emailSplit[emailSplit.length-1].split('.');
					if (domainSplit.length < 2) {
						valid = false;
					} else {
						var reg = /[^a-zA-Z0-9\-]/;
						valid = !reg.test(domainSplit[0])
					}
				}

			// Check for valid phone number
			} else if (validationType == 'phone') {
				phone_number = value.replace(/\-/g, '').replace(/\ /g, '');
				if (phone_number.charAt(0) != '0' || phone_number.length < 10) {
					valid = false;
				} else {
					var reg = /[^0-9]/;
					valid = !reg.test(phone_number);
				}

			// Check that notes is not empty
			} else if (validationType == 'notes') {
				valid = true;

			// Check that password is not empty
			} else if (validationType == 'password') {
				valid = true;

			// Check that date is not empty
			} else if (validationType == 'date') {
				date = value.split('-');
				if (date.length != 3) {
					valid = false;
				} else {
					year = parseInt(date[0]);
					month = parseInt(date[1]);
					day = parseInt(date[2]);
					if (year < 2020 || month < 1 || month > 12 || day < 1 || day > 31) {
						valid = false;
					} else {
						var reg = /[^0-9\-]/;
						valid = !reg.test(value);
					}
				}

			// If invalid form-validation-type
			} else {
				valid = false;
			}

		// If no input
		} else {
			valid = false;
		}

		printMessage(selector, valid);
		return valid;
	}

	// Clear messages and print current message
	function printMessage(selector, valid) {
		var id = selector.attr('id');

		if (!valid) {
			//$('#' + id + '_msg').show();
			$('#' + id).removeClass('is-valid');
			$('#' + id).addClass('is-invalid');
		} else {
			//$('#' + id + '_msg').hide();
			$('#' + id).removeClass('is-invalid');
			$('#' + id).addClass('is-valid');
		}
	}

	// What to do when submit button is clicked
	$('.form-validate').click(function(event) {
		var form = $(this).closest('form');
		if (form.attr('form-validation') == undefined || form.attr('form-validation') != 'true') {

			// Do not validate
			return true;

		} else {

			// Validate
			var valid = true;
			$('form#' + form.attr('id') + ' :input').each(function() {
				if ($(this).attr('form-validation') == 'true') {
					valid = validateInput($(this)) && valid;
				};
			});
			if (valid) {
				return true;
			} else {
				return false;
			}
		}
	});
});