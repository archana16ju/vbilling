import { PrinterDesignState } from '@/store/usePrinterDesignStore';

export function generateReceiptHtml(saleData: any, design: PrinterDesignState) {
  const dateObj = new Date(saleData.timestamp || Date.now());
  let formattedDate = '';
  const dd = String(dateObj.getDate()).padStart(2, '0'); const mm = String(dateObj.getMonth() + 1).padStart(2, '0'); const yyyy = dateObj.getFullYear();
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  switch (design.dateFormat) {
    case 'DD-MM-YYYY': formattedDate = `${dd}-${mm}-${yyyy}`; break;
    case 'YYYY-MM-DD': formattedDate = `${yyyy}-${mm}-${dd}`; break;
    case 'DD MMM YYYY': formattedDate = `${dd} ${months[dateObj.getMonth()]} ${yyyy}`; break;
    default: formattedDate = `${dd}/${mm}/${yyyy}`; break;
  }

  let formattedTime = ''; let hours = dateObj.getHours(); const minutes = String(dateObj.getMinutes()).padStart(2, '0');
  if (design.timeFormat === '24-hour') { formattedTime = `${String(hours).padStart(2, '0')}:${minutes}`; }
  else { const ampm = hours >= 12 ? 'PM' : 'AM'; hours = hours % 12 || 12; formattedTime = `${String(hours).padStart(2, '0')}:${minutes} ${ampm}`; }

  const paperWidth = design.paperSize === '58mm' ? '58mm' : design.paperSize === '80mm' ? '80mm' : '210mm';
  const baseFontSize = design.fontSize || 14;

  let itemsHtml = '';
  if (saleData.items && saleData.items.length > 0) {
    itemsHtml = saleData.items.map((item: any) => {
      let itemNameStr = design.showItemName ? item.product.name : '';
      if (design.showSku && item.product.sku) itemNameStr += ` [${item.product.sku}]`;
      let itemLine = `<div class="row"><div class="name">${itemNameStr}</div>`;
      if (design.showQuantity) itemLine += `<div class="qty">${item.quantity}${design.showUnit && item.product.unit ? ' ' + item.product.unit : ''}</div>`;
      if (design.showRate) itemLine += `<div class="price">₹${item.rate || item.product.price}</div>`;
      if (design.showItemTotal) itemLine += `<div class="price">₹${item.total || (item.quantity * item.product.price).toFixed(2)}</div>`;
      itemLine += `</div>`;
      return itemLine;
    }).join('');
  }

  const footerLines = design.footerText.split('\n').filter(Boolean);

  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Receipt - ${(saleData.id || saleData.billId) || ''}</title>
    <style>
      * { margin: 0; padding: 0; box-sizing: border-box; }
      body { font-family: 'Courier New', Courier, monospace; font-size: ${baseFontSize}px; width: ${paperWidth}; max-width: ${paperWidth}; margin: 0 auto; padding: 2mm 5mm; color: #000; background: #fff; text-align: ${design.textAlignment}; }
      .restaurant-name { font-size: ${baseFontSize * 1.4}px; font-weight: ${design.companyNameBold ? 'bold' : 'normal'}; text-align: center; margin-bottom: 2px; }
      .sub-title { font-size: ${baseFontSize * 0.85}px; text-align: center; margin-bottom: 6px;  }
      .divider { border-top: 1px dashed #000; margin: 6px 0; }
      .divider-solid { border-top: 1px solid #000; margin: 6px 0; }
      .row { display: flex; justify-content: space-between; margin: 3px 0; font-size: ${baseFontSize}px; text-align: left; }
      .row .name { flex: 1; padding-right: 4px; word-break: break-word; }
      .row .qty { width: 30px; text-align: center; }
      .row .price { width: 70px; text-align: right; }
      .header-row { display: flex; justify-content: space-between; font-size: ${baseFontSize * 0.85}px; font-weight: bold; padding-bottom: 4px; margin-bottom: 4px; text-align: left; }
      .totals-row { display: flex; justify-content: space-between; padding: 3px 0; font-size: ${baseFontSize}px; }
      .grand-total { display: flex; justify-content: space-between; font-size: ${baseFontSize * 1.3}px; font-weight: bold; margin-top: 4px; }
      .inv-info { font-size: ${baseFontSize * 0.85}px; display: flex; justify-content: space-between; margin: 3px 0; text-align: left; }
      .footer { font-size: ${baseFontSize * 0.85}px; text-align: center; margin-top: 10px; }
      @media print { body { width: ${paperWidth}; margin: 0 auto; display: flex; flex-direction: column; align-items: stretch; justify-content: center; } @page { margin: 0 auto; size: ${paperWidth} auto; } }
    </style></head><body>
    ${design.showCompanyName ? `<div class="restaurant-name">${design.companyName}</div>` : ''}
    ${(design.showLocation && design.location) || (design.showPhoneNumber && design.phoneNumber) || (design.showEmail && design.email) || (design.showWebsite && design.website) || (design.showGstNumber && design.gstNumber) ? `<div class="sub-title">${design.showLocation && design.location ? design.location.replace(/\n/g, '<br>') + '<br>' : ''}${design.showPhoneNumber && design.phoneNumber ? 'Ph: ' + design.phoneNumber + '<br>' : ''}${design.showEmail && design.email ? 'Email: ' + design.email + '<br>' : ''}${design.showWebsite && design.website ? 'Web: ' + design.website + '<br>' : ''}${design.showGstNumber && design.gstNumber ? 'GST: ' + design.gstNumber : ''}</div>` : ''}
    ${design.showHeader && design.customHeaderText ? `<div class="sub-title" style="font-weight: bold;">${design.customHeaderText}</div>` : ''}
    <hr class="divider">
    ${design.showBillId ? `<div class="inv-info"><span>Bill No:</span><span>${(saleData.id || saleData.billId) || ''}</span></div>` : ''}
    ${design.showDate || design.showTime ? `<div class="inv-info"><span>Date:</span><span>${design.showDate ? formattedDate : ''} ${design.showTime ? formattedTime : ''}</span></div>` : ''}
    <hr class="divider">
    <div class="header-row"><div class="name">Item</div>${design.showQuantity ? `<div class="qty">Qty</div>` : ''}${design.showRate ? `<div class="price">Rate</div>` : ''}${design.showItemTotal ? `<div class="price">Total</div>` : ''}</div>
    ${itemsHtml}
    <hr class="divider-solid">
    ${design.showSubtotal ? `<div class="totals-row"><span>Subtotal</span><span>₹${saleData.subtotal || 0}</span></div>` : ''}
    ${design.showBillDiscount && saleData.discount > 0 ? `<div class="totals-row"><span>Discount</span><span>-₹${saleData.discount}</span></div>` : ''}
    ${design.showBillTax && saleData.tax > 0 ? `<div class="totals-row"><span>Tax</span><span>+₹${saleData.tax}</span></div>` : ''}
    ${design.showGrandTotal ? `<hr class="divider"><div class="grand-total"><span>TOTAL</span><span>₹${saleData.total || 0}</span></div><hr class="divider">` : ''}
    ${design.showPaymentMethod ? `<div class="inv-info"><span>Payment:</span><span>${saleData.paymentMethod || 'Cash'}</span></div>` : ''}
    ${design.showFooter ? `<div class="footer">${footerLines.map(l => `<div>${l}</div>`).join('')}</div>` : ''}
    <script>window.onload = function() { window.print(); setTimeout(function() { window.close(); }, 1000); }</script>
  </body></html>`;
}
