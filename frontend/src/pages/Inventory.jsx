import React from 'react'
import { useAppContext } from '../context/AppContext'
import { Archive, Layers } from 'lucide-react'

const Inventory = () => {
  const { inventory } = useAppContext()

  return (
    <div>
      <div className="page-header">
        <h1>Inventory</h1>
        <p>Manage paper types, single/double side pricing, stock levels, and low-stock alerts.</p>
      </div>

      <div className="card">
        <div className="bill-view-header">
          <div>
            <h2>Inventory Items</h2>
            <p className="text-muted">Maintain price tables for color and black & white printing.</p>
          </div>
        </div>
        <div className="table-container">
          <table className="table">
            <thead>
              <tr>
                <th>Item</th>
                <th>Color Single</th>
                <th>Color Double</th>
                <th>B&amp;W Single</th>
                <th>B&amp;W Double</th>
                <th>Stock</th>
              </tr>
            </thead>
            <tbody>
              {inventory.map((item) => (
                <tr key={item.id}>
                  <td>{item.name}</td>
                  <td>₹{item.colorSingle.toFixed(2)}</td>
                  <td>₹{item.colorDouble.toFixed(2)}</td>
                  <td>₹{item.bwSingle.toFixed(2)}</td>
                  <td>₹{item.bwDouble.toFixed(2)}</td>
                  <td>{item.stock}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

export default Inventory
