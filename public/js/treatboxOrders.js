const baseUrl = `${window.location.origin}${window.location.pathname}`;

function markAsPaid(e) {
  e.preventDefault();

  const id = $(this).attr('class').split('-')[1];
  const url = `${baseUrl}/markaspaid/${id}`;
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
  const url = `${baseUrl}/markasinvoiced/${id}`;
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
  const url = `${baseUrl}/cancel/${id}`;
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
  const url = `${baseUrl}/updateSMS/${recipientCode}`;
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
  const url = `${baseUrl}/getSMS/${id}-${recipientNumber}`;
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

function moveUp(e) {
  e.preventDefault();
  e.stopPropagation();

  const htmlId = $(this).attr('id');
  const [, year, week, id, recipientNumber] = htmlId.split('-');

  if (recipientNumber === '') {
    return false;
  }

  let prevId = '';
  $(`a[id^=moveup-${year}-${week}-`).each(function callback() {
    if ($(this).attr('id') === htmlId) {
      return false;
    }
    prevId = $(this).attr('id');
    return true;
  });

  if (prevId === '') {
    return;
  }

  const [,,, previousId, previousRecipientNumber] = prevId.split('-');
  const url = `${baseUrl}/swapOrder/${id}-${recipientNumber}-${previousId}-${previousRecipientNumber}`;
  $.ajax({
    method: 'get',
    url
  }).done((data) => {
    $(`#row-${id}-${recipientNumber}`).hide().insertBefore(`#row-${previousId}-${previousRecipientNumber}`).show();
    $(`#inforow-${id}-${recipientNumber}`).hide().insertBefore(`#row-${previousId}-${previousRecipientNumber}`).show();
    if ($(`#${prevId}`).hasClass('top')) {
      $(`#${htmlId}`).addClass('top');
      $(`#${prevId}`).removeClass('top');
    }
  }).catch((error) => {
    console.log(error);
  });
}

function swishRefund() {
  const id = $(this).attr('id').split('-')[1];
  const amount = parseInt($(`#swishrefundamount-${id}`).val(), 10);
  const url = `${baseUrl}/swishrefund`;
  if (Number.isNaN(amount)) {
    return;
  }
  $.ajax({
    method: 'post',
    url,
    data: {
      id,
      amount
    }
  }).done((data) => {
    if (data.status === 'OK') {
      console.log('ok');
    }
  }).catch((error) => {
    console.log(error);
  });
}

$(() => {
  $('a[class^=markasinvoiced-]').click(markAsInvoiced);
  $('a[class^=markaspaid-]').click(markAsPaid);
  $('button[name=cancel]').click(cancelOrder);

  $('a[id^=moveup-').click(moveUp);
  $('.map-icon').click(function(e) {
    e.stopPropagation();
  });

  $('.modal[id^=smsedit]').on('hidden.bs.modal', getSMS);
  $('button[name=update-sms]').click(updateSMS);

  $('button[id^=swishrefund-]').click(swishRefund);
});
