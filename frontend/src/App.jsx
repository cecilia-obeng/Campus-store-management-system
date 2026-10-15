import { useEffect, useMemo, useRef, useState } from 'react'
import './App.css'

const API = import.meta.env.VITE_API_URL || '/api'
const stamp = '2026-10-14T08:00:00.000Z'
const seedProducts = [
  { id: 1, name: 'Campus Hoodie', category_id: 2, category_name: 'Campus Merchandise', price: 38, stock_quantity: 7, reorder_level: 10, is_low_stock: true, created_at: stamp, updated_at: stamp },
  { id: 2, name: 'Wireless Earbuds', category_id: 3, category_name: 'Electronics', price: 24.5, stock_quantity: 18, reorder_level: 5, is_low_stock: false, created_at: stamp, updated_at: stamp },
  { id: 3, name: 'Still Water 500ml', category_id: 1, category_name: 'Beverages', price: 1.5, stock_quantity: 6, reorder_level: 12, is_low_stock: true, created_at: stamp, updated_at: stamp },
  { id: 4, name: 'Campus Notebook', category_id: 6, category_name: 'Stationery', price: 4.25, stock_quantity: 10, reorder_level: 10, is_low_stock: true, created_at: stamp, updated_at: stamp },
  { id: 5, name: 'Trail Mix Pack', category_id: 5, category_name: 'Snacks', price: 3.75, stock_quantity: 9, reorder_level: 10, is_low_stock: true, created_at: stamp, updated_at: stamp },
  { id: 6, name: 'USB-C Cable', category_id: 3, category_name: 'Electronics', price: 8.99, stock_quantity: 3, reorder_level: 5, is_low_stock: true, created_at: stamp, updated_at: stamp },
]
const fallbackCategoryOptions = [{ id: 1, name: 'Beverages' }, { id: 2, name: 'Campus Merchandise' }, { id: 3, name: 'Electronics' }, { id: 4, name: 'Personal Care' }, { id: 5, name: 'Snacks' }, { id: 6, name: 'Stationery' }]
const isoNow = () => new Date().toISOString()
const today = isoNow()
const seedSales = [
  { id: 2048, product_id: 1, product_name: 'Campus Hoodie', category_id: 2, category_name: 'Campus Merchandise', quantity: 1, unit_price: 38, total: 38, payment_method: 'card', sale_date: today, created_at: today },
  { id: 2047, product_id: 3, product_name: 'Still Water 500ml', category_id: 1, category_name: 'Beverages', quantity: 3, unit_price: 1.5, total: 4.5, payment_method: 'cash', sale_date: today, created_at: today },
  { id: 2046, product_id: 4, product_name: 'Campus Notebook', category_id: 6, category_name: 'Stationery', quantity: 2, unit_price: 4.25, total: 8.5, payment_method: 'mobile_money', sale_date: today, created_at: today },
]
const money = value => 'GHS ' + new Intl.NumberFormat('en-GH', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(value || 0))
const toLocalInputDateTime = value => {
  const date = new Date(value)
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16)
}
const localDateTime = () => toLocalInputDateTime(new Date())
const pageFromHash = () => ({ overview: 'Overview', products: 'Products', sales: 'Sales' }[window.location.hash.slice(1).toLowerCase()] || 'Overview')

async function apiRequest(path, options = {}) {
  const response = await fetch(API + path, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
  })
  if (response.status === 204) return null
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) {
    const error = new Error(payload?.error?.message || 'Request failed. Please try again.')
    error.details = payload?.error?.details || []
    throw error
  }
  return payload.data
}

function fieldErrorsFrom(error) {
  return Object.fromEntries((error.details || []).map(detail => [
    detail.field,
    detail.available == null ? detail.message : `Only ${detail.available} available.`,
  ]))
}

export default function App() {
  const [page, setPageState] = useState(pageFromHash)
  const [products, setProducts] = useState(seedProducts)
  const [categories, setCategories] = useState(fallbackCategoryOptions)
  const [categoriesLoading, setCategoriesLoading] = useState(false)
  const [categoriesError, setCategoriesError] = useState('')
  const [productPageItems, setProductPageItems] = useState([])
  const [productMeta, setProductMeta] = useState({ page: 1, limit: 20, total: 0 })
  const [productPageLoading, setProductPageLoading] = useState(false)
  const [productPageError, setProductPageError] = useState('')
  const [productPage, setProductPage] = useState(1)
  const [sales, setSales] = useState(seedSales)
  const [salesLoading, setSalesLoading] = useState(true)
  const [salesError, setSalesError] = useState('')
  const [salesMeta, setSalesMeta] = useState({ page: 1, limit: 20, total: 0 })
  const [salesPage, setSalesPage] = useState(1)
  const [summary, setSummary] = useState(null)
  const [summaryLoading, setSummaryLoading] = useState(true)
  const [summaryError, setSummaryError] = useState('')
  const [dailyData, setDailyData] = useState([])
  const [dailyLoading, setDailyLoading] = useState(true)
  const [dailyError, setDailyError] = useState('')
  const [summaryRange, setSummaryRange] = useState({ from: '', to: '' })
  const [apiMode, setApiMode] = useState('connecting')
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [retry, setRetry] = useState(0)
  const [productDialog, setProductDialog] = useState(null)
  const [saleDialog, setSaleDialog] = useState(false)
  const [saleToCorrect, setSaleToCorrect] = useState(null)
  const [busy, setBusy] = useState(false)
  const [actionError, setActionError] = useState('')
  const [fieldErrors, setFieldErrors] = useState({})
  const [notice, setNotice] = useState('')
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [category, setCategory] = useState('all')
  const [lowOnly, setLowOnly] = useState(false)
  const [saleFilters, setSaleFilters] = useState({ from: '', to: '', payment: 'all', product: 'all' })

  const [clockNow] = useState(() => new Date())

  useEffect(() => {
    const syncRoute = () => setPageState(pageFromHash())
    window.addEventListener('hashchange', syncRoute)
    window.addEventListener('popstate', syncRoute)
    if (!window.location.hash) window.history.replaceState(null, '', '#overview')
    return () => {
      window.removeEventListener('hashchange', syncRoute)
      window.removeEventListener('popstate', syncRoute)
    }
  }, [])

  function setPage(nextPage) {
    const hash = '#' + nextPage.toLowerCase()
    if (window.location.hash !== hash) window.history.pushState(null, '', hash)
    setPageState(nextPage)
  }

  useEffect(() => {
    let cancelled = false
    fetch(API + '/products?limit=100&sort=name')
      .then(response => {
        if (!response.ok) throw new Error('Could not load products')
        return response.json()
      })
      .then(payload => {
        if (!Array.isArray(payload.data)) throw new Error('Unexpected product response')
        if (!cancelled) {
          setProducts(payload.data)
          setCategoriesLoading(true)
          setCategoriesError('')
          setProductPageLoading(true)
          setProductPageError('')
          setSummaryLoading(true)
          setDailyLoading(true)
          setApiMode('connected')
        }
      })
      .catch(() => {
        if (!cancelled) {
          setApiMode('demo')
          setProductPageLoading(false)
          setCategoriesLoading(false)
          setSalesLoading(false)
          setSummaryLoading(false)
          setDailyLoading(false)
          setLoadError('The API is unavailable. You can explore the sample products or retry.')
        }
      })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [retry])

  useEffect(() => {
    if (apiMode !== 'connected') return
    let cancelled = false
    fetch(API + '/categories')
      .then(response => {
        if (!response.ok) throw new Error('Could not load categories')
        return response.json()
      })
      .then(payload => {
        if (!Array.isArray(payload.data)) throw new Error('Unexpected category response')
        if (!cancelled) setCategories(payload.data)
      })
      .catch(() => {
        if (!cancelled) setCategoriesError('Categories could not be loaded. Retry to try again.')
      })
      .finally(() => { if (!cancelled) setCategoriesLoading(false) })
    return () => { cancelled = true }
  }, [apiMode, retry])

  useEffect(() => {
    if (apiMode !== 'connected') return
    let cancelled = false
    const params = new URLSearchParams({ page: String(productPage), limit: '20', sort: 'name' })
    if (debouncedSearch) params.set('search', debouncedSearch)
    if (category !== 'all') params.set('category_id', category)
    if (lowOnly) params.set('low_stock', 'true')
    fetch(API + '/products?' + params.toString())
      .then(response => {
        if (!response.ok) throw new Error('Could not load the product list')
        return response.json()
      })
      .then(payload => {
        if (!Array.isArray(payload.data) || !payload.meta) throw new Error('Unexpected product list response')
        if (!cancelled) {
          setProductPageItems(payload.data)
          setProductMeta(payload.meta)
          setProductPageError('')
        }
      })
      .catch(() => { if (!cancelled) setProductPageError('Products could not be loaded. Retry to try again.') })
      .finally(() => { if (!cancelled) setProductPageLoading(false) })
    return () => { cancelled = true }
  }, [apiMode, productPage, debouncedSearch, category, lowOnly, retry])

  useEffect(() => {
    if (apiMode !== 'connected') return
    let cancelled = false
    const params = new URLSearchParams({ page: String(salesPage), limit: '20', sort: '-sale_date' })
    if (saleFilters.from) params.set('from', saleFilters.from)
    if (saleFilters.to) params.set('to', saleFilters.to)
    if (saleFilters.product !== 'all') params.set('product_id', saleFilters.product)
    if (saleFilters.payment !== 'all') params.set('payment_method', saleFilters.payment)
    fetch(API + '/sales?' + params.toString())
      .then(response => {
        if (!response.ok) throw new Error('Could not load sales')
        return response.json()
      })
      .then(payload => {
        if (!Array.isArray(payload.data) || !payload.meta) throw new Error('Unexpected sales response')
        if (!cancelled) { setSales(payload.data); setSalesMeta(payload.meta); setSalesError('') }
      })
      .catch(() => { if (!cancelled) setSalesError('Sales history is unavailable. Retry the connection above.') })
      .finally(() => { if (!cancelled) setSalesLoading(false) })
    return () => { cancelled = true }
  }, [apiMode, saleFilters, salesPage, retry])

  useEffect(() => {
    if (apiMode !== 'connected') return
    let cancelled = false
    const params = new URLSearchParams()
    if (summaryRange.from) params.set('from', summaryRange.from)
    if (summaryRange.to) params.set('to', summaryRange.to)
    const query = params.toString()
    fetch(API + '/summary' + (query ? '?' + query : ''))
      .then(response => {
        if (!response.ok) throw new Error('Could not load dashboard summary')
        return response.json()
      })
      .then(payload => {
        if (!payload.data || typeof payload.data.total_revenue !== 'number') throw new Error('Unexpected summary response')
        if (!cancelled) { setSummary(payload.data); setSummaryError('') }
      })
      .catch(() => { if (!cancelled) setSummaryError('Dashboard summary is unavailable. Retry when the API is ready.') })
      .finally(() => { if (!cancelled) setSummaryLoading(false) })
    return () => { cancelled = true }
  }, [apiMode, summaryRange, retry])

  useEffect(() => {
    if (apiMode !== 'connected') return
    let cancelled = false
    fetch(API + '/summary/daily?days=7')
      .then(response => {
        if (!response.ok) throw new Error('Could not load daily revenue')
        return response.json()
      })
      .then(payload => {
        if (!Array.isArray(payload.data)) throw new Error('Unexpected daily summary response')
        if (!cancelled) { setDailyData(payload.data); setDailyError('') }
      })
      .catch(() => { if (!cancelled) setDailyError('Daily revenue data is unavailable until the daily summary API is ready.') })
      .finally(() => { if (!cancelled) setDailyLoading(false) })
    return () => { cancelled = true }
  }, [apiMode, retry])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const nextSearch = search.trim().toLowerCase()
      if (nextSearch !== debouncedSearch) {
        setProductPage(1)
        if (apiMode === 'connected') {
          setProductPageLoading(true)
          setProductPageError('')
        }
      }
      setDebouncedSearch(nextSearch)
    }, 250)
    return () => window.clearTimeout(timer)
  }, [search, debouncedSearch, apiMode])

  const productCategories = [...new Map(products.map(product => [product.category_id, { id: product.category_id, name: product.category_name }])).values()]
  const categoryOptions = categories.length ? categories : productCategories
  const formCategories = apiMode === 'connected' ? categoryOptions : fallbackCategoryOptions
  const lowProducts = products.filter(product => product.is_low_stock)
  const demoFilteredProducts = useMemo(() => products.filter(product =>
    product.name.toLowerCase().includes(debouncedSearch) &&
    (category === 'all' || String(product.category_id) === category) &&
    (!lowOnly || product.is_low_stock)
  ), [products, debouncedSearch, category, lowOnly])
  const pageSize = apiMode === 'connected' ? productMeta.limit : 20
  const productTotal = apiMode === 'connected' ? productMeta.total : demoFilteredProducts.length
  const visibleProducts = apiMode === 'connected'
    ? productPageItems
    : demoFilteredProducts.slice((productPage - 1) * pageSize, productPage * pageSize)
  const productPageCount = Math.max(1, Math.ceil(productTotal / pageSize))
  const demoFilteredSales = useMemo(() => sales.filter(sale => {
    const day = sale.sale_date.slice(0, 10)
    return (!saleFilters.from || day >= saleFilters.from) &&
      (!saleFilters.to || day <= saleFilters.to) &&
      (saleFilters.payment === 'all' || sale.payment_method === saleFilters.payment) &&
      (saleFilters.product === 'all' || String(sale.product_id) === saleFilters.product)
  }), [sales, saleFilters])
  const visibleSales = apiMode === 'connected'
    ? sales
    : demoFilteredSales.slice((salesPage - 1) * 20, salesPage * 20)
  const salesTotal = apiMode === 'connected' ? salesMeta.total : demoFilteredSales.length
  const salesPageCount = Math.max(1, Math.ceil(salesTotal / 20))
  const revenue = sales.reduce((sum, sale) => sum + Number(sale.total), 0)
  const averageOrder = sales.length ? revenue / sales.length : 0

  function refreshApiData() {
    if (apiMode !== 'connected') return
    setLoading(true)
    setProductPageLoading(true)
    setSalesLoading(true)
    setSalesPage(1)
    setSummaryLoading(true)
    setDailyLoading(true)
    setRetry(value => value + 1)
  }

  function changeSummaryRange(field, value) {
    setSummaryLoading(true)
    setSummaryError('')
    setSummary(null)
    setSummaryRange(current => ({ ...current, [field]: value }))
  }

  function showNotice(message) {
    setNotice(message)
    window.setTimeout(() => setNotice(''), 2800)
  }

  async function saveProduct(event) {
    event.preventDefault()
    setBusy(true)
    setActionError('')
    setFieldErrors({})
    const form = new FormData(event.currentTarget)
    const name = String(form.get('name')).trim()
    const categoryName = formCategories.find(option => option.id === Number(form.get('category_id')))?.name || 'Unknown category'
    const body = {
      name,
      category_id: Number(form.get('category_id')),
      price: Number(form.get('price')),
      stock_quantity: Number(form.get('stock_quantity')),
      reorder_level: Number(form.get('reorder_level') || 10),
    }
    try {
      if (apiMode === 'connected') {
        const saved = await apiRequest(productDialog?.id ? '/products/' + productDialog.id : '/products', {
          method: productDialog?.id ? 'PUT' : 'POST',
          body: JSON.stringify(body),
        })
        setProducts(current => productDialog?.id
          ? current.map(product => product.id === saved.id ? saved : product)
          : [saved, ...current])
      } else {
        const existing = productDialog?.id ? products.find(product => product.id === productDialog.id) : null
        const mock = {
          id: existing?.id || Math.max(0, ...products.map(product => product.id)) + 1,
          name, category_id: body.category_id, category_name: categoryName,
          price: body.price, stock_quantity: body.stock_quantity, reorder_level: body.reorder_level,
          is_low_stock: existing?.is_low_stock ?? false,
          created_at: existing?.created_at || isoNow(), updated_at: isoNow(),
        }
        setProducts(current => existing ? current.map(product => product.id === mock.id ? mock : product) : [mock, ...current])
      }
      refreshApiData()
      setProductDialog(null)
      showNotice(apiMode === 'connected' ? 'Product saved.' : 'Demo product saved in this browser session.')
    } catch (error) {
      setActionError(error.message)
      setFieldErrors(fieldErrorsFrom(error))
    } finally {
      setBusy(false)
    }
  }

  async function deleteProduct(product) {
    if (!window.confirm('Delete ' + product.name + '?')) return
    setActionError('')
    try {
      if (apiMode === 'connected') await apiRequest('/products/' + product.id, { method: 'DELETE' })
      setProducts(current => current.filter(item => item.id !== product.id))
      refreshApiData()
      showNotice(apiMode === 'connected' ? 'Product deleted.' : 'Demo product removed for this session.')
    } catch (error) {
      setActionError(error.message)
    }
  }

  async function saveSale(event) {
    event.preventDefault()
    setBusy(true)
    setActionError('')
    setFieldErrors({})
    const form = new FormData(event.currentTarget)
    const product = products.find(item => item.id === Number(form.get('product_id')))
    const quantity = Number(form.get('quantity'))
    if (!product || quantity < 1 || quantity > product.stock_quantity) {
      setActionError(product ? 'Quantity exceeds the available stock.' : 'Choose a product.')
      setBusy(false)
      return
    }
    const saleDate = new Date(String(form.get('sale_date'))).toISOString()
    const body = { product_id: product.id, quantity, payment_method: String(form.get('payment_method')), sale_date: saleDate }
    try {
      if (apiMode === 'connected') {
        const saved = await apiRequest('/sales', { method: 'POST', body: JSON.stringify(body) })
        setSales(current => [saved, ...current])
        refreshApiData()
        if (saved.is_low_stock) showNotice(product.name + ' is now low on stock.')
        else showNotice('Sale recorded.')
      } else {
        const demoSale = {
          id: Date.now(), product_id: product.id, product_name: product.name,
          category_id: product.category_id, category_name: product.category_name,
          quantity, unit_price: product.price, total: quantity * product.price,
          payment_method: body.payment_method, sale_date: saleDate, created_at: new Date().toISOString(),
        }
        setSales(current => [demoSale, ...current])
        showNotice('Demo sale added. Inventory changes when the API is connected.')
      }
      setSaleDialog(false)
    } catch (error) {
      setActionError(error.message)
      setFieldErrors(fieldErrorsFrom(error))
    } finally {
      setBusy(false)
    }
  }

  async function correctSale(event) {
    event.preventDefault()
    setBusy(true)
    setActionError('')
    setFieldErrors({})
    const form = new FormData(event.currentTarget)
    const body = {
      quantity: Number(form.get('quantity')),
      payment_method: String(form.get('payment_method')),
      sale_date: new Date(String(form.get('sale_date'))).toISOString(),
    }
    try {
      if (apiMode === 'connected') {
        const updated = await apiRequest('/sales/' + saleToCorrect.id, { method: 'PUT', body: JSON.stringify(body) })
        setSales(current => current.map(sale => sale.id === updated.id ? updated : sale))
      } else {
        setSales(current => current.map(sale => sale.id === saleToCorrect.id
          ? { ...sale, ...body, total: body.quantity * sale.unit_price }
          : sale))
      }
      refreshApiData()
      setSaleToCorrect(null)
      showNotice(apiMode === 'connected' ? 'Sale updated.' : 'Demo sale corrected for this session.')
    } catch (error) {
      setActionError(error.message)
      setFieldErrors(fieldErrorsFrom(error))
    } finally {
      setBusy(false)
    }
  }

  async function cancelSale(sale) {
    if (!window.confirm('Cancel this sale? The API restores its stock.')) return
    try {
      if (apiMode === 'connected') await apiRequest('/sales/' + sale.id, { method: 'DELETE' })
      setSales(current => current.filter(item => item.id !== sale.id))
      refreshApiData()
      showNotice(apiMode === 'connected' ? 'Sale cancelled and stock restored.' : 'Demo sale removed; demo stock is not changed.')
    } catch (error) {
      showNotice(error.message)
    }
  }

  return <div className="shell">
    <aside className="sidebar">
      <div className="brand"><b>?</b><span><strong>campus<span>store</span></strong><small>SALES TRACKER</small></span></div>
      <p>WORKSPACE</p>
      {['Overview', 'Products', 'Sales'].map(name => <button key={name} className={'nav ' + (page === name ? 'active' : '')} onClick={() => setPage(name)}>{name}</button>)}
      <div className="profile"><b>CO</b><span><strong>Cecilia Obeng</strong><small>Store manager</small></span></div>
    </aside>
    <main>
      <header>Campus Store / <strong>{page}</strong><label>{apiMode === 'connected' ? 'LIVE API' : apiMode === 'connecting' ? 'CONNECTING' : 'DEMO DATA'}</label></header>
      <div className="content">
        {loadError && <div className="connection-banner" role="status"><span>{loadError}</span><button onClick={() => { setLoadError(''); setSalesError(''); setSummaryError(''); setDailyError(''); setLoading(true); setProductPageLoading(true); setSalesLoading(true); setSummaryLoading(true); setDailyLoading(true); setRetry(value => value + 1) }}>Retry</button></div>}
        {actionError && <div className="error-banner" role="alert">{actionError}<button aria-label="Dismiss error" onClick={() => setActionError('')}>Dismiss</button></div>}

        {page === 'Overview' && <Overview now={clockNow} products={products} sales={sales} lowProducts={lowProducts} revenue={revenue} averageOrder={averageOrder} summary={summary} summaryLoading={summaryLoading} summaryError={summaryError} dailyData={dailyData} dailyLoading={dailyLoading} dailyError={dailyError} summaryRange={summaryRange} onSummaryRangeChange={changeSummaryRange} onSummaryRetry={() => { setSummary(null); setSummaryError(''); setDailyError(''); setSummaryLoading(true); setDailyLoading(true); setRetry(value => value + 1) }} apiMode={apiMode} onNavigate={setPage} onRecord={() => setSaleDialog(true)} loading={loading} />}
        {page === 'Products' && <section>
          <div className="heading"><div><small>INVENTORY</small><h1>Products</h1><p>Manage your catalogue and stock levels.</p></div><button className="primary" disabled={apiMode === 'connected' && (categoriesLoading || Boolean(categoriesError))} onClick={() => { setActionError(''); setProductDialog({}) }}>+ Add product</button></div>
          {categoriesError && <div className="error-banner" role="alert">{categoriesError}<button onClick={() => setRetry(value => value + 1)}>Retry</button></div>}
          <div className="filters"><input aria-label="Search products" placeholder="Search by product name..." value={search} onChange={event => setSearch(event.target.value)} /><select aria-label="Filter by category" value={category} onChange={event => { setCategory(event.target.value); setProductPage(1); if (apiMode === 'connected') { setProductPageLoading(true); setProductPageError('') } }}><option value="all">All categories</option>{categoryOptions.map(option => <option key={option.id} value={option.id}>{option.name}</option>)}</select><label className="toggle"><input type="checkbox" checked={lowOnly} onChange={event => { setLowOnly(event.target.checked); setProductPage(1); if (apiMode === 'connected') { setProductPageLoading(true); setProductPageError('') } }} />Low stock only</label><span>{productTotal} products</span></div>
          {loading || productPageLoading ? <div className="panel state" role="status">Loading products…</div> : loadError ? <div className="panel state" role="alert">Products could not be loaded. Use Retry above to try again.</div> : productPageError ? <div className="panel state" role="alert">{productPageError}<button onClick={() => { setProductPageLoading(true); setRetry(value => value + 1) }}>Retry</button></div> : visibleProducts.length === 0 ? <div className="panel state">{debouncedSearch || category !== 'all' || lowOnly ? 'No products match these filters.' : 'No products yet. Add the first product to get started.'}</div> : <>
            <ProductCards products={visibleProducts} onEdit={product => { setActionError(''); setProductDialog(product) }} onDelete={deleteProduct} />
            {productPageCount > 1 && <nav className="pagination" aria-label="Product pages"><button disabled={productPage <= 1} onClick={() => { if (apiMode === 'connected') { setProductPageLoading(true); setProductPageError('') } setProductPage(value => Math.max(1, value - 1)) }}>Previous</button><span>Page {productPage} of {productPageCount}</span><button disabled={productPage >= productPageCount} onClick={() => { if (apiMode === 'connected') { setProductPageLoading(true); setProductPageError('') } setProductPage(value => Math.min(productPageCount, value + 1)) }}>Next</button></nav>}
          </>}
        </section>}

        {page === 'Sales' && <section>
          <div className="heading"><div><small>TRANSACTIONS</small><h1>Sales history</h1><p>View, filter, correct, or cancel a sale.</p></div><button className="primary" onClick={() => { setActionError(''); setSaleDialog(true) }}>+ Record sale</button></div>
          <div className="filters sale-filters"><label>From<input type="date" value={saleFilters.from} onChange={event => { setSaleFilters(current => ({ ...current, from: event.target.value })); setSalesPage(1); if (apiMode === 'connected') setSalesLoading(true) }} /></label><label>To<input type="date" value={saleFilters.to} onChange={event => { setSaleFilters(current => ({ ...current, to: event.target.value })); setSalesPage(1); if (apiMode === 'connected') setSalesLoading(true) }} /></label><label>Product<select value={saleFilters.product} onChange={event => { setSaleFilters(current => ({ ...current, product: event.target.value })); setSalesPage(1); if (apiMode === 'connected') setSalesLoading(true) }}><option value="all">All products</option>{products.map(product => <option key={product.id} value={product.id}>{product.name}</option>)}</select></label><label>Payment<select value={saleFilters.payment} onChange={event => { setSaleFilters(current => ({ ...current, payment: event.target.value })); setSalesPage(1); if (apiMode === 'connected') setSalesLoading(true) }}><option value="all">All methods</option><option value="cash">Cash</option><option value="mobile_money">Mobile money</option><option value="card">Card</option></select></label><button onClick={() => { setSaleFilters({ from: '', to: '', payment: 'all', product: 'all' }); setSalesPage(1); if (apiMode === 'connected') setSalesLoading(true) }}>Clear filters</button></div>
          {salesLoading ? <div className="panel state" role="status">Loading sales...</div> : salesError ? <div className="panel state" role="alert">{salesError}<button onClick={() => { setSalesError(''); setSalesLoading(true); setRetry(value => value + 1) }}>Retry</button></div> : <><SalesList sales={visibleSales} onCorrect={sale => { setActionError(''); setSaleToCorrect(sale) }} onCancel={cancelSale} />{salesPageCount > 1 && <nav className="pagination" aria-label="Sales pages"><button disabled={salesPage <= 1} onClick={() => { setSalesLoading(true); setSalesPage(value => Math.max(1, value - 1)) }}>Previous</button><span>Page {salesPage} of {salesPageCount}</span><button disabled={salesPage >= salesPageCount} onClick={() => { setSalesLoading(true); setSalesPage(value => Math.min(salesPageCount, value + 1)) }}>Next</button></nav>}</>}
        </section>}

        <footer>Campus Store Sales Tracker <span>{apiMode === 'connected' ? 'Connected to API' : apiMode === 'connecting' ? 'Connecting to API' : 'Demo data; changes are not saved to the database'}</span></footer>
      </div>
    </main>

    {productDialog && <ProductForm product={productDialog.id ? productDialog : null} categories={formCategories} busy={busy} error={actionError} fieldErrors={fieldErrors} onClose={() => { setProductDialog(null); setActionError('') }} onSubmit={saveProduct} />}
    {saleDialog && <SaleForm products={products} busy={busy} error={actionError} fieldErrors={fieldErrors} onClose={() => { setSaleDialog(false); setActionError('') }} onSubmit={saveSale} />}
    {saleToCorrect && <SaleCorrection sale={saleToCorrect} busy={busy} error={actionError} fieldErrors={fieldErrors} onClose={() => { setSaleToCorrect(null); setActionError('') }} onSubmit={correctSale} />}
    {notice && <div className="toast" role="status">{notice}</div>}
  </div>
}

function Overview({ now, products, sales, lowProducts, summary, summaryLoading, summaryError, dailyData, dailyLoading, dailyError, summaryRange, onSummaryRangeChange, onSummaryRetry, apiMode, onNavigate, onRecord, loading }) {
  const greeting = now.getHours() < 12 ? 'Good morning' : now.getHours() < 18 ? 'Good afternoon' : 'Good evening'
  const inRange = sales.filter(sale => {
    const day = sale.sale_date.slice(0, 10)
    return (!summaryRange.from || day >= summaryRange.from) && (!summaryRange.to || day <= summaryRange.to)
  })
  const demoRevenue = inRange.reduce((sum, sale) => sum + Number(sale.total), 0)
  const live = apiMode === 'connected'
  const revenueValue = live ? summary?.total_revenue : demoRevenue
  const orderValue = live ? summary?.total_orders : inRange.length
  const averageValue = live ? summary?.average_order_value : (inRange.length ? demoRevenue / inRange.length : 0)
  const lowCount = live ? summary?.low_stock_count : lowProducts.length
  const topProducts = live ? (summary?.top_products || []) : Object.values(inRange.reduce((groups, sale) => {
    const item = groups[sale.product_id] || { product_id: sale.product_id, product_name: sale.product_name, category_name: sale.category_name, units_sold: 0, revenue: 0 }
    item.units_sold += sale.quantity
    item.revenue += sale.total
    groups[sale.product_id] = item
    return groups
  }, {})).sort((a, b) => b.revenue - a.revenue).slice(0, 5)
  const value = input => summaryLoading && live ? '...' : input == null ? '...' : input
  const demoDays = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - 6 + index)).toISOString().slice(0, 10)
    const matchingSales = sales.filter(sale => sale.sale_date.slice(0, 10) === date)
    return { date, revenue: matchingSales.reduce((sum, sale) => sum + Number(sale.total), 0), orders: matchingSales.length }
  })
  const chartDays = live ? dailyData : demoDays
  const maxRevenue = Math.max(0, ...chartDays.map(day => Number(day.revenue)))

  return <>
    <div className="heading"><div><small>{new Intl.DateTimeFormat('en-GH', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(now).toUpperCase()}</small><h1>{greeting}, Cecilia</h1><p>Here&apos;s what&apos;s happening at your store today.</p></div><button className="primary" onClick={onRecord}>+ Record sale</button></div>
    <div className="filters summary-filters"><label>From<input type="date" value={summaryRange.from} onChange={event => onSummaryRangeChange('from', event.target.value)} /></label><label>To<input type="date" value={summaryRange.to} onChange={event => onSummaryRangeChange('to', event.target.value)} /></label>{(summaryRange.from || summaryRange.to) && <button onClick={() => { onSummaryRangeChange('from', ''); onSummaryRangeChange('to', '') }}>Clear dates</button>}</div>
    {summaryError && live && <div className="error-banner" role="alert">{summaryError}<button onClick={onSummaryRetry}>Retry</button></div>}
    <div className="metrics"><Metric label="Total revenue" value={revenueValue == null ? value(null) : money(revenueValue)} foot={live ? 'API summary for selected dates' : 'Demo sales only'} /><Metric label="Total orders" value={value(orderValue)} foot={live ? 'API summary for selected dates' : 'Demo sales only'} /><Metric label="Average order value" value={averageValue == null ? value(null) : money(averageValue)} foot={live ? 'API summary for selected dates' : 'Demo sales only'} /><Metric label="Low stock items" value={loading ? '...' : value(lowCount)} foot="API-reported stock flags" warn /></div>
    <div className="grid"><section className="panel"><Title title="Revenue overview" sub={live ? 'Daily chart requires the shared daily-summary endpoint' : 'Illustrative sample activity'} /><b className="revenue">{revenueValue == null ? '...' : money(revenueValue)}</b>{live && dailyLoading ? <p className="state" role="status">Loading daily revenue...</p> : live && dailyError ? <p className="state" role="alert">{dailyError}<button onClick={onSummaryRetry}>Retry</button></p> : <><div className="chart" role="img" aria-label="Revenue for the last seven UTC days">{chartDays.map(day => <i key={day.date} title={day.date + ': ' + money(day.revenue)} style={{ height: maxRevenue ? Math.max(4, Number(day.revenue) / maxRevenue * 100) + '%' : '4%' }} />)}</div><div className="days">{chartDays.map(day => <span key={day.date}>{new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric', timeZone: 'UTC' }).format(new Date(day.date + 'T00:00:00Z'))}</span>)}</div></>}</section>
      <section className="panel"><Title title="Low stock alerts" sub="API-reported products at or below reorder level" />{lowProducts.length ? lowProducts.slice(0, 5).map(product => <div className="alert" key={product.id}><b>{product.name}</b><span>{product.stock_quantity} left - level {product.reorder_level}</span></div>) : <p className="state">No low-stock products reported.</p>}<button className="link" onClick={() => onNavigate('Products')}>Review inventory &gt;</button></section></div>
    <div className="grid"><section className="panel"><Title title="Top products" sub="Ranked by revenue" />{live && summaryLoading ? <p className="state" role="status">Loading top products…</p> : live && summaryError ? <p className="state" role="alert">Top products are unavailable.</p> : topProducts.length ? topProducts.map(product => <div className="alert" key={product.product_id}><b>{product.product_name}</b><span>{product.units_sold} sold - {money(product.revenue)}</span></div>) : <p className="state">No product sales in this period.</p>}</section>
      <section className="panel"><Title title="Inventory snapshot" sub="Current product list" /><ProductCards products={products.slice(0, 3)} compact onEdit={() => onNavigate('Products')} onDelete={() => onNavigate('Products')} /><button className="link" onClick={() => onNavigate('Products')}>View all products &gt;</button></section></div>
    <div className="grid"><section className="panel"><Title title="Recent sales" sub="Demo or currently loaded sales" /><SalesList sales={sales.slice(0, 4)} compact /><button className="link" onClick={() => onNavigate('Sales')}>View all sales &gt;</button></section></div>
  </>
}

function ProductCards({ products, onEdit, onDelete, compact = false }) {
  return <div className={'product-grid' + (compact ? ' compact' : '')}>{products.map(product => <article className="product-card" key={product.id}><div className="product-card-top"><span>{product.category_name}</span><em className={product.is_low_stock ? 'low' : 'ok'}>{product.is_low_stock ? 'Low stock' : 'In stock'}</em></div><h3>{product.name}</h3><strong>{money(product.price)}</strong><p>{product.stock_quantity} in stock</p>{!compact && <div className="card-actions"><button onClick={() => onEdit(product)}>Edit</button><button className="danger-link" onClick={() => onDelete(product)}>Delete</button></div>}</article>)}</div>
}

function ProductForm({ product, categories, busy, error, fieldErrors, onClose, onSubmit }) {
  return <Modal title={product ? 'Edit product' : 'Add product'} onClose={onClose}><form onSubmit={onSubmit}>
    <p className="form-hint">Fields marked <RequiredMarker /> are required.</p>
    <label>Product name <RequiredMarker /><input name="name" required maxLength="100" minLength="2" defaultValue={product?.name || ''} />{fieldErrors.name && <small className="field-error">{fieldErrors.name}</small>}</label>
    <label>Category <RequiredMarker /><select name="category_id" required defaultValue={product?.category_id || categories[0]?.id || ''}>{categories.map(option => <option key={option.id} value={option.id}>{option.name}</option>)}</select>{fieldErrors.category_id && <small className="field-error">{fieldErrors.category_id}</small>}</label>
    <label>Price (GHS) <RequiredMarker /><input name="price" type="number" min="0" max="99999999.99" step="0.01" required defaultValue={product?.price ?? ''} />{fieldErrors.price && <small className="field-error">{fieldErrors.price}</small>}</label>
    <label>Stock quantity <RequiredMarker /><input name="stock_quantity" type="number" min="0" step="1" required defaultValue={product?.stock_quantity ?? ''} />{fieldErrors.stock_quantity && <small className="field-error">{fieldErrors.stock_quantity}</small>}</label>
    <label>Reorder level<input name="reorder_level" type="number" min="0" step="1" defaultValue={product?.reorder_level ?? 10} />{fieldErrors.reorder_level && <small className="field-error">{fieldErrors.reorder_level}</small>}</label>
    {error && <p className="form-error" role="alert">{error}</p>}<div className="actions"><button type="button" onClick={onClose}>Cancel</button><button className="primary" disabled={busy}>{busy ? 'Saving…' : 'Save product'}</button></div>
  </form></Modal>
}

function SaleForm({ products, busy, error, fieldErrors, onClose, onSubmit }) {
  const available = products.filter(product => product.stock_quantity > 0)
  return <Modal title="Record a sale" onClose={onClose}><form onSubmit={onSubmit}>
    <p className="form-hint">Fields marked <RequiredMarker /> are required.</p>
    <label>Product <RequiredMarker /><select name="product_id" required defaultValue=""><option value="" disabled>Select a product</option>{available.map(product => <option key={product.id} value={product.id}>{product.name} · {product.stock_quantity} available</option>)}</select>{fieldErrors.product_id && <small className="field-error">{fieldErrors.product_id}</small>}</label>
    <label>Quantity <RequiredMarker /><input name="quantity" type="number" min="1" max="10000" step="1" required defaultValue="1" />{fieldErrors.quantity && <small className="field-error">{fieldErrors.quantity}</small>}</label>
    <label>Payment method <RequiredMarker /><select name="payment_method" required><option value="cash">Cash</option><option value="mobile_money">Mobile money</option><option value="card">Card</option></select>{fieldErrors.payment_method && <small className="field-error">{fieldErrors.payment_method}</small>}</label>
    <label>Sale date <RequiredMarker /><input name="sale_date" type="datetime-local" max={localDateTime()} defaultValue={localDateTime()} required />{fieldErrors.sale_date && <small className="field-error">{fieldErrors.sale_date}</small>}</label>
    <p className="form-hint">The API checks available stock and supplies the sale price.</p>
    {error && <p className="form-error" role="alert">{error}</p>}<div className="actions"><button type="button" onClick={onClose}>Cancel</button><button className="primary" disabled={busy || available.length === 0}>{busy ? 'Saving…' : 'Record sale'}</button></div>
  </form></Modal>
}

function SaleCorrection({ sale, busy, error, fieldErrors, onClose, onSubmit }) {
  return <Modal title="Correct sale" onClose={onClose}><form onSubmit={onSubmit}>
    <p className="form-hint">Fields marked <RequiredMarker /> are required.</p>
    <label>Quantity <RequiredMarker /><input name="quantity" type="number" min="1" max="10000" required defaultValue={sale.quantity} />{fieldErrors.quantity && <small className="field-error">{fieldErrors.quantity}</small>}</label>
    <label>Payment method <RequiredMarker /><select name="payment_method" defaultValue={sale.payment_method}><option value="cash">Cash</option><option value="mobile_money">Mobile money</option><option value="card">Card</option></select>{fieldErrors.payment_method && <small className="field-error">{fieldErrors.payment_method}</small>}</label>
    <label>Sale date <RequiredMarker /><input name="sale_date" type="datetime-local" required defaultValue={toLocalInputDateTime(sale.sale_date)} />{fieldErrors.sale_date && <small className="field-error">{fieldErrors.sale_date}</small>}</label>
    {error && <p className="form-error" role="alert">{error}</p>}<div className="actions"><button type="button" onClick={onClose}>Cancel</button><button className="primary" disabled={busy}>{busy ? 'Saving…' : 'Save correction'}</button></div>
  </form></Modal>
}

function Modal({ title, children, onClose }) {
  const dialogRef = useRef(null)

  useEffect(() => {
    const previousFocus = document.activeElement
    const dialog = dialogRef.current
    const focusable = () => [...dialog.querySelectorAll('button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])')]
    focusable()[0]?.focus()
    return () => {
      if (previousFocus instanceof HTMLElement) previousFocus.focus()
    }
  }, [])

  function handleKeyDown(event) {
    if (event.key === 'Escape') {
      onClose()
      return
    }
    if (event.key !== 'Tab') return
    const items = [...dialogRef.current.querySelectorAll('button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])')]
    if (!items.length) {
      event.preventDefault()
      dialogRef.current.focus()
    } else if (event.shiftKey && document.activeElement === items[0]) {
      event.preventDefault()
      items[items.length - 1].focus()
    } else if (!event.shiftKey && document.activeElement === items[items.length - 1]) {
      event.preventDefault()
      items[0].focus()
    }
  }

  return <div className="backdrop" onMouseDown={event => { if (event.target === event.currentTarget) onClose() }}><section ref={dialogRef} className="dialog" role="dialog" aria-modal="true" aria-label={title} tabIndex={-1} onKeyDown={handleKeyDown}><h2>{title}</h2>{children}</section></div>
}

function RequiredMarker() { return <span className="required-marker" aria-label="required">*</span> }

function SalesList({ sales, onCorrect, onCancel, compact = false }) {
  return <section className="panel"><Title title={compact ? '' : 'Sales history'} sub={compact ? '' : sales.length + ' matching sales'} />{sales.length ? sales.map(sale => <article className="sale" key={sale.id}><span><b>{sale.product_name}</b><small>{sale.quantity} item{sale.quantity === 1 ? '' : 's'} · {new Date(sale.sale_date).toLocaleString()}</small></span><strong>{money(sale.total)}</strong>{!compact && <div className="sale-actions"><button onClick={() => onCorrect(sale)}>Correct</button><button className="danger-link" onClick={() => onCancel(sale)}>Cancel</button></div>}</article>) : <p className="state">No sales match these filters.</p>}</section>
}

function Metric({ label, value, foot, warn }) { return <article className="metric"><div>{label}<i className={warn ? 'warn' : ''}>{warn ? '!' : '?'}</i></div><b>{value}</b><small>{foot}</small></article> }
function Title({ title, sub }) { return <div className="panel-title">{title && <h2>{title}</h2>}{sub && <small>{sub}</small>}</div> }
