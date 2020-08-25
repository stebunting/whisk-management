// Calculator Elements
const elements = {
  recipeTin: document.getElementById('recipe-tin-size'),
  recipeQuantity: document.getElementById('recipe-quantity'),
  requiredTin: document.getElementById('required-tin-size'),
  requiredQuantity: document.getElementById('required-quantity'),
  ratio: document.getElementById('ratio')
};

// Update Ratio
function update() {
  const recipeTinRadius = parseInt(elements.recipeTin.value, 10) / 2 || 0;
  const recipeQuantity = parseInt(elements.recipeQuantity.value, 10) || 0;
  const recipeArea = Math.PI * recipeTinRadius ** 2 * recipeQuantity;

  const requiredTinRadius = parseInt(elements.requiredTin.value, 10) / 2 || 0;
  const requiredQuantity = parseInt(elements.requiredQuantity.value, 10) || 0;
  const requiredArea = Math.PI * requiredTinRadius ** 2 * requiredQuantity;

  const ratio = requiredArea / recipeArea;
  if (ratio > 0 && ratio !== Infinity) {
    elements.ratio.value = ratio.toFixed(2);
  }
}

// Add listener for focus out
Object.keys(elements).forEach((key) => {
  elements[key].addEventListener('input', () => {
    update();
  });
});
