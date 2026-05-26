/**
 * ProductsSection
 *
 * The "Products you use" section — patient-entered products.
 *
 * Tapping the prompt is placeholder for the real add flow (Chunk 4).
 *
 * Props:
 *   products: array of product objects from data.products
 */
function ProductsSection({ products }) {
  function handleAdd() {
    alert("Add a product will be wired up in Chunk 4.")
  }

  return (
    <section className="section">
      <div className="section-head">
        <h2 className="section-title">Products you use</h2>
        {products && products.length > 0 && (
          <span className="section-meta">{products.length}</span>
        )}
      </div>

      {(!products || products.length === 0) ? (
        <div className="empty-state">
          A running list of skincare and other products in your routine.
        </div>
      ) : (
        <ul className="products-list">
          {products.map((product) => (
            <li key={product.id} className="product-item">
              <div className="product-name">{product.name}</div>
              {product.notes && (
                <div className="product-notes">{product.notes}</div>
              )}
            </li>
          ))}
        </ul>
      )}

      <button type="button" onClick={handleAdd} className="add-prompt">
        <span className="add-prompt-icon" aria-hidden="true">+</span>
        <span className="add-prompt-text">Add a product</span>
      </button>
    </section>
  )
}

export default ProductsSection