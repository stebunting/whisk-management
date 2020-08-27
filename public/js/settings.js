$(`#settingsTabs a[href="${window.location.hash}"]`).tab('show');

// Add datepicker objects
// $('#timeframe-delivery-time, #timeframe-deadline-time, #timeframe-vegetable-deadline-time')
//   .each(function callback() {
//     $(this).datetimepicker();
//   });

function showRebateInfo(id, show = true) {
  const parent = document.getElementById(`rebate-amount-container-${id}`);
  const newNode = show === false
    ? ''
    : `<input type="text" class="form-control" id="rebate-amount-${id}" name="rebate-amount-${id}" placeholder="Percentage" />`;
  parent.innerHTML = newNode;
}
const rebateSelectors = document.querySelectorAll('select[id^="rebate-type"');
for (let i = 0; i < rebateSelectors.length; i += 1) {
  rebateSelectors[i].addEventListener('change', (event) => {
    const id = event.target.id.split('-')[2];
    if (event.target.value === 'discountPercent') {
      showRebateInfo(id);
    } else {
      showRebateInfo(id, false);
    }
  });
}
