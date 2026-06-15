# PrintBillingApp - Print Shop Billing & Accounting System

A comprehensive React-based billing and accounting application designed for print shops. Features include itemized billing, payment handling, customer management, inventory tracking, and financial reporting.

## Features

### Core Features
- **Billing Management**
  - Create and manage print orders with itemized billing
  - Support for color/B&W and single/double-sided printing
  - Flexible discount options (flat or percentage)
  - Split payment handling (cash + UPI)
  - Advance credit and overpayment management

- **Payment Processing**
  - Cash and UPI payment options
  - Full/partial payment support
  - Follow-up payment recording
  - UPI deep link generation for online payments
  - Payment history tracking

- **Customer Management**
  - Regular and random customer support
  - Customer credit balance tracking
  - Contact information management
  - Payment history per customer

- **Inventory System**
  - Print type pricing (color/B&W, single/double-sided)
  - Stock tracking
  - Dynamic pricing based on print specifications

- **Accounting & Reporting**
  - Monthly and yearly revenue reports
  - Receivables tracking
  - Inventory valuation
  - Notification alerts for pending payments

### Advanced Features

- **User Authentication**
  - Login/logout functionality with role-based access
  - Admin and Staff roles
  - Secure session management
  - User profile management

- **Data Management**
  - Full JSON backup and restore
  - CSV export for bills, customers, inventory, and payments
  - Bulk import of customers and inventory items
  - Data validation and recovery tools

- **Advanced Search & Filtering**
  - Multi-field search across bills, customers, and inventory
  - Date range filtering for bills
  - Amount range filtering
  - Customer group filtering
  - Status-based filtering
  - Sort and order customization

- **Recurring Bills**
  - Set up weekly/monthly recurring bills
  - Auto-schedule recurring transactions
  - Manage active/inactive recurring bills
  - Template-based bill generation

- **Customer Statements & Ledger**
  - Complete payment history per customer
  - Transaction-wise ledger with running balance
  - Monthly statement generation and export
  - Outstanding balance tracking
  - Advance credit management

- **Receipt Printing**
  - Print-ready receipt format
  - Customer and bill details
  - Item-wise breakdown
  - Payment status display
  - Browser-based PDF printing

- **Additional Features**
  - Bill deletion and restoration
  - PDF/image export functionality
  - Business profile management with UPI ID
  - Settings for GST and view modes
  - Notification system

## Tech Stack

- **Frontend**: React 18 + Vite
- **Icons**: Lucide React
- **Styling**: Vanilla CSS (dark theme)
- **State Management**: React Context + useReducer
- **Persistence**: LocalStorage
- **Export**: jsPDF + html2canvas
- **Backend**: Node.js + Express (pending implementation)

## Project Structure

```
app1/
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── layout/
│   │   │   │   ├── Sidebar.jsx
│   │   │   │   └── Header.jsx
│   │   │   └── ...
│   │   ├── pages/
│   │   │   ├── Dashboard.jsx
│   │   │   ├── Billing.jsx
│   │   │   ├── Customers.jsx
│   │   │   ├── Inventory.jsx
│   │   │   ├── Accounting.jsx
│   │   │   ├── DeletedBills.jsx
│   │   │   ├── Settings.jsx
│   │   │   └── Notifications.jsx
│   │   ├── context/
│   │   │   └── AppContext.jsx
│   │   ├── api/
│   │   │   └── ...
│   │   ├── index.css
│   │   ├── main.jsx
│   │   └── App.jsx
│   ├── package.json
│   └── vite.config.js
└── backend/
    ├── server.js
    ├── package.json
    ├── config/
    │   └── db.js
    ├── controllers/
    │   ├── billController.js
    │   ├── customerController.js
    │   ├── inventoryController.js
    │   └── paymentController.js
    ├── middleware/
    │   └── errorHandler.js
    └── schema.sql
```

## Getting Started

### Frontend Setup

```bash
cd frontend
npm install
npm run dev
```

The frontend will be available at `http://localhost:5173`

### Backend Setup (Coming Soon)

```bash
cd backend
npm install
npm start
```

## Usage

1. **Create Bills**: Navigate to Billing page, select customer, add items, specify payment mode
2. **Record Payments**: Use the Follow-up Payment section in bill details to record partial/full payments
3. **Generate UPI Links**: Create shareable UPI payment links for customers
4. **Manage Customers**: Add/update customer information and track credit balances
5. **View Reports**: Check accounting reports for revenue, receivables, and inventory

## Payment Methods

- **Cash**: Direct cash payment recording
- **UPI**: Digital payment via UPI protocol with deep link support
- **Credit**: Advance customer credit that can be applied to bills
- **Overpayment**: Excess payments automatically converted to customer credit

## Data Persistence

All data is persisted to browser's LocalStorage automatically. Clear browser data to reset the application.

## Development

### Frontend Technologies

- React 18 with Hooks
- Vite for fast build and HMR
- CSS Grid for responsive layout
- Lucide React for icons
- jsPDF for PDF generation
- html2canvas for image capture

### State Management

The application uses React Context API with useReducer for centralized state management:
- `AppContext.jsx`: Main context with all business logic
- Actions: ADD_BILL, ADD_PAYMENT, UPDATE_CUSTOMER, etc.
- LocalStorage sync for persistence

## Future Enhancements

- Backend API integration
- Database persistence
- User authentication
- Email invoice delivery
- SMS notifications
- Advanced analytics
- Multi-shop support
- Cloud backup

## License

Private Project

## Author

Print Shop Billing Team
