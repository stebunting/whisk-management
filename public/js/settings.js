$(`#settingsTabs a[href="${window.location.hash}"]`).tab('show');

// Add datepicker objects
// $('#timeframe-delivery-time, #timeframe-deadline-time, #timeframe-vegetable-deadline-time')
//   .each(function callback() {
//     $(this).datetimepicker();
//   });

$('input[id^=rebate-expiry').datepicker({
  format: 'yyyy-mm-dd',
  autoclose: true,
  weekStart: 1
});

function showRebateInfo(show = true) {
  const parent = document.getElementById('rebate-amount-container');
  const newNode = show === false
    ? ''
    : '<input type="text" class="form-control" id="rebate-amount" name="rebate-amount" placeholder="Percentage" />';
  parent.innerHTML = newNode;
}
const rebateSelector = document.getElementById('rebate-type');
rebateSelector.addEventListener('change', (event) => {
  if (event.target.value === 'discountPercent') {
    showRebateInfo(true);
  } else {
    showRebateInfo(false);
  }
});
