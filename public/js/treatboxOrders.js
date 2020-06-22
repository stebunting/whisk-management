function markAsPaid(e) {
  e.preventDefault();

  const id = $(this).attr('class').split('-')[1];
  const url = `${window.location.href}/markaspaid/${id}`;
  $.ajax({
    method: 'get',
    url
  }).done((data) => {
    if (data.status === 'OK') {
      $(`.statusicon-${id}`).attr('src', '/icons/paid.svg').attr('alt', 'Paid!');
      $(`.status-${id}`).text('Paid');
      $(`.markaspaid-${id}`).remove();
    }
  }).catch((error) => {
    console.log(error);
  });
}

function markAsInvoiced(e) {
  e.preventDefault();

  const id = $(this).attr('class').split('-')[1];
  const url = `${window.location.href}/markasinvoiced/${id}`;
  $.ajax({
    method: 'get',
    url
  }).done((data) => {
    if (data.status === 'OK') {
      $(`.statusicon-${id}`).attr('src', '/icons/invoice.svg').attr('alt', 'Invoiced');
      $(`.status-${id}`).text('Invoiced');
      $(`<a href="#" class="markaspaid-${id}">(Mark as Paid)</a>`).click(markAsPaid).insertAfter($('a[class^=\'markasinvoiced-\']'));
      $(`.markasinvoiced-${id}`).remove();
    }
  }).catch((error) => {
    console.log(error);
  });
}

function cancelOrder() {
  const id = $(this).val();
  const url = `${window.location.href}/cancel/${id}`;
  $.ajax({
    method: 'get',
    url
  }).done((data) => {
    if (data.status === 'OK') {
      $(`.statusicon-${id}`).attr('src', '/icons/cancelled.svg').attr('alt', 'Cancelled');
      $(`.status-${id}`).text('Cancelled');
      $(`.markaspaid-${id}`).remove();
      $(`.markasinvoiced-${id}`).remove();
    }
  }).catch((error) => {
    console.log(error);
  });
}

function updateSMS() {
  const recipientCode = $(this).val();
  const message = $(`#smstext-${recipientCode}`).val();
  const url = `${window.location.href}/updateSMS/${recipientCode}`;
  $.ajax({
    method: 'post',
    url,
    data: {
      message
    }
  }).done((data) => {
    if (data.status === 'OK') {
      $(`#smslink-${recipientCode}`).attr('href', data.link);
      $(`#smsedit-${recipientCode}`).modal('hide');
    }
  }).catch((error) => {
    console.log(error);
  });
}

function getSMS() {
  const [, id, recipientNumber] = $(this).attr('id').split('-');
  const url = `${window.location.href}/getSMS/${id}-${recipientNumber}`;
  $.ajax({
    method: 'get',
    url
  }).done((data) => {
    if (data.status === 'OK') {
      $(`#smstext-${id}-${recipientNumber}`).val(data.message);
    }
  }).catch((error) => {
    console.log(error);
  });
}

$(() => {
  $('a[class^=\'markasinvoiced-\']').click(markAsInvoiced);
  $('a[class^=\'markaspaid-\']').click(markAsPaid);
  $('button[name=cancel]').click(cancelOrder);

  $('.modal[id^=smsedit').on('hidden.bs.modal', getSMS);
  $('button[name=update-sms').click(updateSMS);
});
