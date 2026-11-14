'use client';

import React, { useState, useEffect, useRef } from 'react';
import { ApiService } from '@/lib/services/api';
import { Customer, Product, Bill, RoundingMethod, AllSettings, LoyaltyRedemptionRule, GroupBill } from '@/lib/types';
import { SupabaseBanner } from '@/components/SupabaseBanner';
import { InvoiceModal } from '@/components/InvoiceModal';
import { GroupInvoiceModal } from '@/components/GroupInvoiceModal';
import {
  Receipt,
  UserPlus,
  Plus,
  Trash2,
  Search,
  CheckCircle2,
  AlertTriangle,
  Calculator,
  Gift,
  Sparkles,
  Percent,
  Clock,
  Banknote,
  Smartphone,
  Split,
  ChevronDown,
  Users,
  Check
} from 'lucide-react';

export type BillingPaymentMode = 'Cash' | 'UPI' | 'Split' | 'Pay Later' | 'Advance';

interface CartItem {
  product_id?: string | null;
  product_name: string;
  quantity: number;
  price: number;
  total: number;
  isDecimal?: boolean;
}

export default function BillingPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [settings, setSettings] = useState<AllSettings | null>(null);
  const [redemptionRules, setRedemptionRules] = useState<LoyaltyRedemptionRule[]>([]);

  // Form State
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('');
  const [cart, setCart] = useState<CartItem[]>([]);

  // Custom Xerox Entry & Autocomplete
  const [customItemName, setCustomItemName] = useState('');
  const [customItemQty, setCustomItemQty] = useState<number | ''>(1);
  const [customItemPrice, setCustomItemPrice] = useState<number | ''>('');
  const [customDropdownOpen, setCustomDropdownOpen] = useState(false);
  const [customHighlightedIndex, setCustomHighlightedIndex] = useState(-1);
  const customInputRef = useRef<HTMLInputElement>(null);
  const customDropdownRef = useRef<HTMLDivElement>(null);
  const [recentCustomItems, setRecentCustomItems] = useState<Array<{ name: string; price: number }>>([]);

  // Catalog search & quick add quantity
  const [productSearch, setProductSearch] = useState('');
  const [catalogQty, setCatalogQty] = useState<number | ''>(1);

  // Discount (Flat vs Percentage) & Rounding
  const [discountType, setDiscountType] = useState<'FLAT' | 'PERCENTAGE'>('FLAT');
  const [discountValue, setDiscountValue] = useState<number>(0);
  const [roundingMethod, setRoundingMethod] = useState<RoundingMethod>('None');

  // Split Payment & Advance Amounts
  const [paymentMode, setPaymentMode] = useState<BillingPaymentMode>('Pay Later');
  const [cashPaid, setCashPaid] = useState<number | ''>('');
  const [upiPaid, setUpiPaid] = useState<number | ''>('');
  const [useAdvance, setUseAdvance] = useState<boolean>(false);
  const [advanceUsed, setAdvanceUsed] = useState<number | ''>('');

  // Loyalty Points Engine State
  const [pointsToRedeem, setPointsToRedeem] = useState<number>(0);
  const [estimatedPointsEarned, setEstimatedPointsEarned] = useState<number>(0);

  // Quick Customer Add Modal
  const [showAddCustomerModal, setShowAddCustomerModal] = useState(false);
  const [newCustName, setNewCustName] = useState('');
  const [newCustMobile, setNewCustMobile] = useState('');
  const [newCustEmail, setNewCustEmail] = useState('');

  // Feedback & Modal state
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [saving, setSaving] = useState(false);
  const [savedBill, setSavedBill] = useState<Bill | null>(null);
  const [savedGroupBill, setSavedGroupBill] = useState<GroupBill | null>(null);

  // Group Billing Mode: 'STANDARD' | 'SPLIT' | 'SHARED'
  const [billingMode, setBillingMode] = useState<'STANDARD' | 'SPLIT' | 'SHARED'>('STANDARD');

  // Split Billing State (Customer A, B, C buy the same items)
  const [splitSelectedCustomerIds, setSplitSelectedCustomerIds] = useState<string[]>([]);
  const [splitCustomerSearch, setSplitCustomerSearch] = useState('');
  const [splitOverrides, setSplitOverrides] = useState<Record<string, {
    use_advance: boolean;
    cash_paid: number | '';
    upi_paid: number | '';
    payment_method: string;
  }>>({});

  // Shared Billing State (Group splits combined order amount)
  const [sharedParticipants, setSharedParticipants] = useState<Array<{
    id: string;
    customer_id?: string | null;
    guest_name?: string;
    share_amount: number;
    paid_by_customer_id?: string | null;
    payment_mode: 'Cash' | 'UPI' | 'Advance' | 'Pay Later';
    cash_paid: number | '';
    upi_paid: number | '';
    use_advance: boolean;
  }>>([]);
  const participantCounterRef = useRef(1);
  const [sharedNewGuestName, setSharedNewGuestName] = useState('');
  const [sharedSelectedCustIdToAdd, setSharedSelectedCustIdToAdd] = useState('');
  const [groupNotes, setGroupNotes] = useState('');

  // Customer Ledger Summary State
  const [customerLedgerData, setCustomerLedgerData] = useState<{ runningBalance: number; pendingPoints: number } | null>(null);

  // Custom Dropdown State
  const [customerDropdownOpen, setCustomerDropdownOpen] = useState(false);
  const [customerSearch, setCustomerSearch] = useState('');
  const customerDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Load stored recent custom items from localStorage
    if (typeof window !== 'undefined') {
      try {
        localStorage.removeItem('printpro_recent_custom_items');
        const stored = localStorage.getItem('printpro_user_custom_items');
        if (stored) {
          const parsed = JSON.parse(stored);
          if (Array.isArray(parsed) && parsed.length > 0) {
            setRecentCustomItems(parsed);
          }
        }
      } catch (err) {
        console.warn('Failed to load recent custom items from storage:', err);
      }
    }

    const handleClickOutside = (event: MouseEvent) => {
      if (customerDropdownRef.current && !customerDropdownRef.current.contains(event.target as Node)) {
        setCustomerDropdownOpen(false);
      }
      if (customDropdownRef.current && !customDropdownRef.current.contains(event.target as Node)) {
        setCustomDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    let active = true;
    if (selectedCustomerId) {
      ApiService.getCustomerLedger(selectedCustomerId).then(res => {
        if (active) {
          setCustomerLedgerData({ runningBalance: res.runningBalance, pendingPoints: res.pendingPoints });
          if (res.customer) {
            setCustomers(prev => prev.map(c => c.id === selectedCustomerId ? { ...c, advance_balance: res.customer!.advance_balance } : c));
          }
        }
      }).catch(() => {
        if (active) setCustomerLedgerData(null);
      });
    } else {
      Promise.resolve().then(() => {
        if (active) setCustomerLedgerData(null);
      });
    }
    return () => { active = false; };
  }, [selectedCustomerId]);

  const fetchInitialData = async () => {
    try {
      const [custList, prodList, shopSettings, redRules] = await Promise.all([
        ApiService.getCustomerSummaries(),
        ApiService.getProducts(),
        ApiService.getSettings(),
        ApiService.getLoyaltyRedemptionRules()
      ]);
      setCustomers(custList);
      setProducts(prodList);
      setSettings(shopSettings);
      setRedemptionRules(redRules);
      setRoundingMethod(shopSettings.billing.rounding_method);
    } catch (err) {
      console.error('Error loading data:', err);
    }
  };

  useEffect(() => {
    let isMounted = true;
    const run = async () => {
      if (isMounted) {
        await fetchInitialData();
      }
    };
    void run();
    return () => { isMounted = false; };
  }, []);

  const selectedCustomer = customers.find(c => c.id === selectedCustomerId);

  // Subtotal & Discount Math (Flat vs Percentage)
  const subtotal = cart.reduce((sum, item) => sum + item.total, 0);

  const manualDiscountApplied = discountType === 'PERCENTAGE'
    ? Number(((subtotal * (discountValue || 0)) / 100).toFixed(2))
    : Number(discountValue || 0);

  const activeRedemptionRules = redemptionRules.filter(r => r.enabled);
  const loyaltyDiscount = settings
    ? ApiService.calculateLoyaltyDiscount(pointsToRedeem, settings.loyalty, activeRedemptionRules)
    : 0;

  const totalAfterDiscount = Math.max(0, subtotal - manualDiscountApplied - loyaltyDiscount);
  const gstAmount = (settings?.billing?.gst_enabled && Number(settings?.billing?.gst_rate) > 0)
    ? Number(((totalAfterDiscount * Number(settings.billing.gst_rate)) / 100).toFixed(2))
    : 0;
  const totalBeforeRounding = totalAfterDiscount + gstAmount;
  const { roundedTotal, roundingAdjustment } = ApiService.calculateRounding(totalBeforeRounding, roundingMethod);

  // Adjust customer advance allocation when customer or total changes
  useEffect(() => {
    let active = true;
    if (selectedCustomerId) {
      const cust = customers.find(c => c.id === selectedCustomerId);
      if (cust && cust.advance_balance > 0) {
        Promise.resolve().then(() => {
          if (active && (useAdvance || paymentMode === 'Advance')) {
            const maxUsable = roundedTotal > 0 ? Math.min(cust.advance_balance, roundedTotal) : cust.advance_balance;
            setAdvanceUsed(prev => {
              const prevNum = Number(prev || 0);
              if (paymentMode === 'Advance' || prev === '' || prevNum > maxUsable) {
                return maxUsable;
              }
              return prev;
            });
          }
        });
      } else {
        Promise.resolve().then(() => {
          if (active) {
            setUseAdvance(false);
            setAdvanceUsed('');
          }
        });
      }
    } else {
      Promise.resolve().then(() => {
        if (active) {
          setUseAdvance(false);
          setAdvanceUsed('');
        }
      });
    }
    return () => { active = false; };
  }, [selectedCustomerId, customers, roundedTotal, useAdvance, paymentMode]);

  useEffect(() => {
    let active = true;
    if (roundedTotal > 0 && settings?.loyalty.enabled) {
      ApiService.calculateLoyaltyPointsEarned(roundedTotal).then(pts => {
        if (active) setEstimatedPointsEarned(pts);
      });
    } else {
      Promise.resolve(0).then(pts => {
        if (active) setEstimatedPointsEarned(pts);
      });
    }
    return () => { active = false; };
  }, [roundedTotal, settings]);

  const cashVal = Number(cashPaid || 0);
  const upiVal = Number(upiPaid || 0);
  const advanceVal = useAdvance ? Number(advanceUsed || 0) : 0;

  const directPaidNow = cashVal + upiVal;
  const totalPaidNow = directPaidNow + advanceVal;
  const remainingBillBalance = Math.max(0, roundedTotal - totalPaidNow);

  const prevOutstanding = Math.max(0, customerLedgerData?.runningBalance || 0);
  const netDueForCurrentBill = Math.max(0, roundedTotal - advanceVal);
  const overpaymentBeyondCurrentBill = Math.max(0, directPaidNow - netDueForCurrentBill);
  const allocatedToPriorBalance = Math.min(prevOutstanding, overpaymentBeyondCurrentBill);
  const customerAdvanceEarned = Math.max(0, overpaymentBeyondCurrentBill - allocatedToPriorBalance);

  const priorPendingPoints = customerLedgerData?.pendingPoints || 0;
  const currentBillPendingPoints = (remainingBillBalance > 0 && estimatedPointsEarned > 0) ? estimatedPointsEarned : 0;
  const totalPendingPoints = priorPendingPoints + currentBillPendingPoints;

  // Add catalog product
  const handleAddProductToCart = (product: Product) => {
    const qtyToAdd = Number(catalogQty) > 0 ? Number(catalogQty) : 1;
    const isDecimalInput = !Number.isInteger(qtyToAdd);
    const existingIdx = cart.findIndex(c => c.product_id === product.id);
    if (existingIdx >= 0) {
      const updated = [...cart];
      updated[existingIdx].quantity += qtyToAdd;
      if (isDecimalInput) updated[existingIdx].isDecimal = true;
      updated[existingIdx].total = updated[existingIdx].quantity * updated[existingIdx].price;
      setCart(updated);
    } else {
      setCart([
        ...cart,
        {
          product_id: product.id,
          product_name: product.name,
          quantity: qtyToAdd,
          price: product.price,
          total: qtyToAdd * product.price,
          isDecimal: isDecimalInput
        }
      ]);
    }
    // Reset quick catalog quantity back to 1
    setCatalogQty(1);
  };

  // Update recent custom items history
  const updateRecentCustomItem = (name: string, price: number) => {
    if (!name.trim()) return;
    const cleanName = name.trim();
    setRecentCustomItems(prev => {
      const filtered = prev.filter(item => item.name.toLowerCase() !== cleanName.toLowerCase());
      const updated = [{ name: cleanName, price }, ...filtered].slice(0, 20);
      if (typeof window !== 'undefined') {
        try {
          localStorage.setItem('printpro_user_custom_items', JSON.stringify(updated));
        } catch { }
      }
      return updated;
    });
  };

  // Custom Item Autocomplete Suggestions (Product Catalog + Recent Custom Items)
  const customSuggestions = React.useMemo(() => {
    const q = customItemName.trim().toLowerCase();
    const list: Array<{ id: string; name: string; price: number; product_id?: string; source: 'catalog' | 'recent' }> = [];
    const seen = new Set<string>();

    // 1. Search products catalog
    if (q) {
      for (const p of products) {
        if (p.name.toLowerCase().includes(q)) {
          list.push({
            id: `prod-${p.id}`,
            name: p.name,
            price: Number(p.price || 0),
            product_id: p.id,
            source: 'catalog'
          });
          seen.add(p.name.toLowerCase());
          if (list.length >= 6) break;
        }
      }
    }

    // 2. Search recent custom items
    for (const r of recentCustomItems) {
      if (!seen.has(r.name.toLowerCase()) && (!q || r.name.toLowerCase().includes(q))) {
        list.push({
          id: `recent-${r.name}`,
          name: r.name,
          price: Number(r.price || 0),
          source: 'recent'
        });
        seen.add(r.name.toLowerCase());
        if (list.length >= 10) break;
      }
    }

    return list;
  }, [customItemName, products, recentCustomItems]);

  // Select autocomplete suggestion and immediately add to cart with Qty = 1
  const handleSelectCustomSuggestion = (item: { name: string; price: number; product_id?: string }) => {
    const qty = Number(customItemQty) > 0 ? Number(customItemQty) : 1;
    const price = Number(item.price);

    setCart(prev => [
      ...prev,
      {
        product_id: item.product_id || null,
        product_name: item.name,
        quantity: qty,
        price,
        total: Number((qty * price).toFixed(2)),
        isDecimal: !Number.isInteger(qty)
      }
    ]);

    updateRecentCustomItem(item.name, price);

    setCustomItemName('');
    setCustomItemQty(1);
    setCustomItemPrice('');
    setCustomDropdownOpen(false);
    setCustomHighlightedIndex(-1);

    setTimeout(() => {
      customInputRef.current?.focus();
    }, 40);
  };

  // Handle keyboard navigation inside autocomplete
  const handleCustomInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!customDropdownOpen && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
      setCustomDropdownOpen(true);
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setCustomHighlightedIndex(prev => (prev < customSuggestions.length - 1 ? prev + 1 : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setCustomHighlightedIndex(prev => (prev > 0 ? prev - 1 : customSuggestions.length - 1));
    } else if (e.key === 'Enter') {
      if (customDropdownOpen && customHighlightedIndex >= 0 && customSuggestions[customHighlightedIndex]) {
        e.preventDefault();
        handleSelectCustomSuggestion(customSuggestions[customHighlightedIndex]);
      }
    } else if (e.key === 'Escape') {
      setCustomDropdownOpen(false);
      setCustomHighlightedIndex(-1);
    }
  };

  // Add custom item manually (e.g., brand-new Xerox / Service pages)
  const handleAddCustomItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customItemName.trim() || Number(customItemQty) <= 0 || Number(customItemPrice) < 0) return;

    const qty = Number(customItemQty);
    const price = Number(customItemPrice);
    const name = customItemName.trim();

    setCart(prev => [
      ...prev,
      {
        product_name: name,
        quantity: qty,
        price,
        total: Number((qty * price).toFixed(2)),
        isDecimal: !Number.isInteger(qty)
      }
    ]);

    updateRecentCustomItem(name, price);
    setCustomItemName('');
    setCustomItemQty(1);
    setCustomItemPrice('');
    setCustomDropdownOpen(false);
    setCustomHighlightedIndex(-1);

    setTimeout(() => {
      customInputRef.current?.focus();
    }, 40);
  };

  // Optionally save a custom item permanently to the inventory catalog
  const handleSaveCustomItemToCatalog = async (item: CartItem) => {
    if (!item.product_name) return;
    try {
      const added = await ApiService.addProduct({
        name: item.product_name,
        category: 'Services',
        price: item.price
      });
      setProducts(prev => [...prev, added]);
      setSuccessMsg(`"${item.product_name}" saved to Products Catalog!`);
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to save product to catalog');
    }
  };

  const handleUpdateItemQty = (index: number, newQty: number) => {
    if (isNaN(newQty) || newQty <= 0) {
      handleRemoveItem(index);
      return;
    }
    const updated = [...cart];
    updated[index].quantity = newQty;
    if (!Number.isInteger(newQty)) {
      updated[index].isDecimal = true;
    }
    updated[index].total = newQty * updated[index].price;
    setCart(updated);
  };

  const handleToggleItemDecimal = (index: number) => {
    const updated = [...cart];
    const currentlyDecimal = !!updated[index].isDecimal;
    updated[index].isDecimal = !currentlyDecimal;
    // If switching off decimal, round quantity to nearest integer (min 1)
    if (currentlyDecimal) {
      const rounded = Math.max(1, Math.round(updated[index].quantity));
      updated[index].quantity = rounded;
      updated[index].total = rounded * updated[index].price;
    }
    setCart(updated);
  };

  // Live Editable Rate Handler
  const handleUpdateItemRate = (index: number, newPrice: number) => {
    const updated = [...cart];
    const price = Math.max(0, newPrice);
    updated[index].price = price;
    updated[index].total = updated[index].quantity * price;
    setCart(updated);
  };

  const handleRemoveItem = (index: number) => {
    setCart(cart.filter((_, i) => i !== index));
  };

  // Quick customer creation
  const handleAddCustomerSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCustName.trim()) return;

    const normalizedTarget = newCustName.trim().replace(/\s+/g, ' ').toLowerCase();
    const existing = customers.find(c => (c.name || '').trim().replace(/\s+/g, ' ').toLowerCase() === normalizedTarget);
    if (existing) {
      setErrorMsg(`Customer "${existing.name}" already exists. Please select the existing customer instead of creating a duplicate.`);
      return;
    }

    try {
      const created = await ApiService.addCustomer({
        name: newCustName.trim(),
        mobile: newCustMobile.trim() || undefined,
        email: newCustEmail.trim() || undefined
      });
      setCustomers([...customers, created]);
      setSelectedCustomerId(created.id);
      setShowAddCustomerModal(false);
      setNewCustName('');
      setNewCustMobile('');
      setNewCustEmail('');
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to add customer');
    }
  };

  // Quick Pay & Mode Selector Handlers
  const handleSelectPaymentMode = (mode: BillingPaymentMode) => {
    setPaymentMode(mode);
    const effAdv = useAdvance ? Number(advanceUsed || 0) : 0;
    const netDue = Math.max(0, roundedTotal - effAdv);

    if (mode === 'Cash') {
      setCashPaid(netDue);
      setUpiPaid('');
    } else if (mode === 'UPI') {
      setUpiPaid(netDue);
      setCashPaid('');
    } else if (mode === 'Pay Later') {
      setCashPaid('');
      setUpiPaid('');
    } else if (mode === 'Advance') {
      const adv = Math.min(selectedCustomer?.advance_balance || 0, roundedTotal);
      setUseAdvance(true);
      setAdvanceUsed(adv > 0 ? adv : '');
      setCashPaid('');
      setUpiPaid('');
    } else if (mode === 'Split') {
      if (cashVal === roundedTotal || upiVal === roundedTotal || cashVal === netDue || upiVal === netDue) {
        setCashPaid('');
        setUpiPaid('');
      }
    }
  };

  // Sync Payment Mode Values on Total / Advance Changes
  useEffect(() => {
    const effAdv = useAdvance ? Number(advanceUsed || 0) : 0;
    const netDue = Math.max(0, roundedTotal - effAdv);

    if (paymentMode === 'Cash') {
      setCashPaid(netDue);
      setUpiPaid('');
    } else if (paymentMode === 'UPI') {
      setUpiPaid(netDue);
      setCashPaid('');
    } else if (paymentMode === 'Advance') {
      const adv = Math.min(selectedCustomer?.advance_balance || 0, roundedTotal);
      setUseAdvance(true);
      setAdvanceUsed(adv > 0 ? adv : '');
    } else if (paymentMode === 'Pay Later') {
      setCashPaid('');
      setUpiPaid('');
    }
  }, [roundedTotal, paymentMode, useAdvance, advanceUsed, selectedCustomer?.advance_balance]);

  // Submit & Create Bill
  const handleCreateBill = async () => {
    setErrorMsg('');
    setSuccessMsg('');

    if (cart.length === 0) {
      setErrorMsg('Please add at least one item to the bill cart.');
      return;
    }

    if (!selectedCustomerId) {
      if (paymentMode === 'Pay Later') {
        setErrorMsg('Please select or create a customer to issue a Pay Later / Credit bill.');
        return;
      }
      setErrorMsg('Please select a customer or add a new customer before generating the bill.');
      return;
    }

    if (selectedCustomer && pointsToRedeem > selectedCustomer.loyalty_points) {
      setErrorMsg(`Customer only has ${selectedCustomer.loyalty_points} loyalty points available.`);
      return;
    }

    const effectiveAdvanceVal = useAdvance ? Number(advanceUsed || 0) : 0;

    if (useAdvance && effectiveAdvanceVal > 0) {
      if (effectiveAdvanceVal > (selectedCustomer?.advance_balance || 0)) {
        setErrorMsg(`Advance amount cannot exceed the customer's available advance balance (₹${(selectedCustomer?.advance_balance || 0).toFixed(2)}).`);
        return;
      }

      if (effectiveAdvanceVal > roundedTotal) {
        setErrorMsg(`Advance amount cannot exceed the current bill amount (₹${roundedTotal.toFixed(2)}).`);
        return;
      }
    }

    setSaving(true);
    try {
      const createdBill = await ApiService.createBill({
        customer_id: selectedCustomerId || null,
        total: subtotal,
        discount: manualDiscountApplied,
        rounding_method: roundingMethod,
        cash_paid: cashVal,
        upi_paid: upiVal,
        advance_used: effectiveAdvanceVal,
        points_to_redeem: pointsToRedeem,
        payment_method: paymentMode === 'Split' ? 'Split Payment' : paymentMode === 'Advance' ? 'Advance Used' : paymentMode,
        items: cart
      });

      if (!createdBill) {
        setErrorMsg('Customer record not found or access denied.');
        return;
      }

      const financialSummary = await ApiService.getBillFinancialSummary(createdBill);
      const billWithSummary = { ...createdBill, financial_summary: financialSummary };

      setSavedBill(billWithSummary);
      setSuccessMsg(`Bill #${createdBill.bill_number} generated successfully!`);

      // Reset form
      setCart([]);
      setDiscountValue(0);
      setCashPaid('');
      setUpiPaid('');
      setUseAdvance(false);
      setAdvanceUsed('');
      setPointsToRedeem(0);
      setSelectedCustomerId('');
      setPaymentMode('Pay Later');

      await fetchInitialData();
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to generate bill');
    } finally {
      setSaving(false);
    }
  };

  // --- SPLIT BILLING HELPERS ---
  const handleToggleSplitCustomer = (custId: string) => {
    setSplitSelectedCustomerIds(prev => {
      if (prev.includes(custId)) {
        const next = prev.filter(id => id !== custId);
        const copy = { ...splitOverrides };
        delete copy[custId];
        setSplitOverrides(copy);
        return next;
      } else {
        return [...prev, custId];
      }
    });
  };

  const handleUpdateSplitOverride = (custId: string, field: 'use_advance' | 'cash_paid' | 'upi_paid' | 'payment_method', val: unknown) => {
    setSplitOverrides(prev => {
      const current = prev[custId] || { use_advance: true, cash_paid: '', upi_paid: '', payment_method: 'Pay Later' };
      return {
        ...prev,
        [custId]: {
          ...current,
          [field]: val
        }
      };
    });
  };

  const handleCreateSplitBillingSubmit = async () => {
    setErrorMsg('');
    setSuccessMsg('');

    if (cart.length === 0) {
      setErrorMsg('Please add at least one item to the cart.');
      return;
    }
    if (splitSelectedCustomerIds.length === 0) {
      setErrorMsg('Please select at least one customer for Split Billing.');
      return;
    }

    setSaving(true);
    try {
      const overridesPayload: Record<string, { use_advance?: boolean; cash_paid?: number; upi_paid?: number; payment_method?: string }> = {};
      Object.entries(splitOverrides).forEach(([cid, ov]) => {
        overridesPayload[cid] = {
          use_advance: ov.use_advance,
          cash_paid: Number(ov.cash_paid || 0),
          upi_paid: Number(ov.upi_paid || 0),
          payment_method: ov.payment_method
        };
      });

      const grp = await ApiService.createSplitBilling({
        items: cart,
        customer_ids: splitSelectedCustomerIds,
        discount_per_customer: manualDiscountApplied,
        rounding_method: roundingMethod,
        notes: groupNotes.trim() || undefined,
        payments_override: overridesPayload
      });

      setSavedGroupBill(grp);
      setSuccessMsg(`Split Group Bill #${grp.group_bill_number} generated successfully for ${splitSelectedCustomerIds.length} customers!`);

      // Reset
      setCart([]);
      setDiscountValue(0);
      setSplitSelectedCustomerIds([]);
      setSplitOverrides({});
      setGroupNotes('');
      await fetchInitialData();
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to generate Split Group Bill');
    } finally {
      setSaving(false);
    }
  };

  // --- SHARED BILLING HELPERS ---
  const handleAddSharedRegisteredParticipant = (custId: string) => {
    if (!custId) return;
    const existing = sharedParticipants.find(p => p.customer_id === custId);
    if (existing) {
      setErrorMsg('This customer is already added as a participant.');
      return;
    }
    const cust = customers.find(c => c.id === custId);
    const newPart = {
      id: `part-${participantCounterRef.current++}-${custId}`,
      customer_id: custId,
      guest_name: cust?.name,
      share_amount: 0,
      paid_by_customer_id: null,
      payment_mode: 'Pay Later' as const,
      cash_paid: '' as number | '',
      upi_paid: '' as number | '',
      use_advance: (cust?.advance_balance || 0) > 0
    };
    const updated = [...sharedParticipants, newPart];
    setSharedParticipants(updated);
    setSharedSelectedCustIdToAdd('');
    autoRecalculateEqualSplit(updated);
  };

  const handleAddSharedGuestParticipant = () => {
    const name = sharedNewGuestName.trim();
    if (!name) return;
    const newPart = {
      id: `part-${participantCounterRef.current++}-guest`,
      customer_id: null,
      guest_name: name,
      share_amount: 0,
      paid_by_customer_id: null,
      payment_mode: 'Cash' as const,
      cash_paid: '' as number | '',
      upi_paid: '' as number | '',
      use_advance: false
    };
    const updated = [...sharedParticipants, newPart];
    setSharedParticipants(updated);
    setSharedNewGuestName('');
    autoRecalculateEqualSplit(updated);
  };

  const handleRemoveSharedParticipant = (id: string) => {
    const updated = sharedParticipants.filter(p => p.id !== id);
    setSharedParticipants(updated);
    if (updated.length > 0) autoRecalculateEqualSplit(updated);
  };

  const autoRecalculateEqualSplit = (partsList: typeof sharedParticipants) => {
    const n = partsList.length;
    if (n === 0) return;
    if (roundedTotal <= 0) {
      setSharedParticipants(partsList.map(p => ({ ...p, share_amount: 0 })));
      return;
    }
    const base = Math.floor((roundedTotal / n) * 100) / 100;
    const remainder = Number((roundedTotal - (base * n)).toFixed(2));
    const updated = partsList.map((p, idx) => ({
      ...p,
      share_amount: idx === 0 ? Number((base + remainder).toFixed(2)) : base
    }));
    setSharedParticipants(updated);
  };

  // Auto-keep shared participant shares equally divided when cart/total changes
  useEffect(() => {
    if (billingMode !== 'SHARED' || sharedParticipants.length === 0) return;
    const n = sharedParticipants.length;
    const base = roundedTotal > 0 ? Math.floor((roundedTotal / n) * 100) / 100 : 0;
    const remainder = roundedTotal > 0 ? Number((roundedTotal - (base * n)).toFixed(2)) : 0;
    const needsUpdate = sharedParticipants.some((p, idx) => {
      const expected = idx === 0 ? Number((base + remainder).toFixed(2)) : base;
      return Math.abs(Number(p.share_amount || 0) - expected) > 0.001;
    });
    if (needsUpdate) {
      setSharedParticipants(prev => prev.map((p, idx) => ({
        ...p,
        share_amount: idx === 0 ? Number((base + remainder).toFixed(2)) : base
      })));
    }
  }, [billingMode, roundedTotal, sharedParticipants]);

  const handleCreateSharedBillingSubmit = async () => {
    setErrorMsg('');
    setSuccessMsg('');

    if (cart.length === 0) {
      setErrorMsg('Please add at least one item to the shared order.');
      return;
    }
    if (sharedParticipants.length === 0) {
      setErrorMsg('Please add at least one participant for Shared Billing.');
      return;
    }

    const n = sharedParticipants.length;
    const base = Math.floor((roundedTotal / n) * 100) / 100;
    const remainder = Number((roundedTotal - (base * n)).toFixed(2));

    setSaving(true);
    try {
      const participantsPayload = sharedParticipants.map((p, idx) => {
        const shareAmt = idx === 0 ? Number((base + remainder).toFixed(2)) : base;
        return {
          customer_id: p.customer_id || null,
          customer_name: p.guest_name,
          share_amount: shareAmt,
          paid_by_customer_id: null,
          cash_paid: 0,
          upi_paid: 0,
          use_advance: false,
          payment_method: 'Pay Later'
        };
      });

      const grp = await ApiService.createSharedBilling({
        items: cart,
        discount: manualDiscountApplied,
        rounding_method: roundingMethod,
        notes: groupNotes.trim() || undefined,
        participants: participantsPayload
      });

      setSavedGroupBill(grp);
      setSuccessMsg(`Shared Group Bill #${grp.group_bill_number} generated successfully for ${sharedParticipants.length} participants!`);

      // Reset
      setCart([]);
      setDiscountValue(0);
      setSharedParticipants([]);
      setGroupNotes('');
      await fetchInitialData();
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to generate Shared Group Bill');
    } finally {
      setSaving(false);
    }
  };

  const filteredProducts = products.filter(p =>
    p.name.toLowerCase().includes(productSearch.toLowerCase()) ||
    p.category.toLowerCase().includes(productSearch.toLowerCase())
  );

  const filteredDropdownCustomers = customers.filter(c =>
    c.name.toLowerCase().includes(customerSearch.trim().toLowerCase()) ||
    (c.mobile && c.mobile.includes(customerSearch.trim()))
  );

  const normalizedNewCustName = newCustName.trim().replace(/\s+/g, ' ').toLowerCase();
  const exactDuplicateNewCust = normalizedNewCustName
    ? customers.find(c => (c.name || '').trim().replace(/\s+/g, ' ').toLowerCase() === normalizedNewCustName)
    : undefined;
  const similarNewCustomers = normalizedNewCustName.length >= 2
    ? customers.filter(c => (c.name || '').toLowerCase().includes(normalizedNewCustName)).slice(0, 4)
    : [];

  return (
    <div className="space-y-6">
      <SupabaseBanner />

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center space-x-2">
            <Receipt className="text-blue-600" size={26} />
            <span>POS Billing & Group Checkout</span>
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">Standard single bills, Split billing across customers, & Shared group billing</p>
        </div>

        {/* TOP MODE SWITCHER */}
        <div className="flex flex-wrap items-center gap-1.5 p-1.5 bg-slate-100 rounded-2xl border border-slate-200">
          <button
            type="button"
            onClick={() => setBillingMode('STANDARD')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              billingMode === 'STANDARD'
                ? 'bg-white text-blue-700 shadow-sm border border-slate-200'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
            }`}
          >
            <Receipt size={14} />
            <span>Standard Bill</span>
          </button>
          <button
            type="button"
            onClick={() => setBillingMode('SPLIT')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              billingMode === 'SPLIT'
                ? 'bg-amber-600 text-white shadow-sm'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
            }`}
          >
            <Split size={14} />
            <span>Split Billing</span>
          </button>
          <button
            type="button"
            onClick={() => setBillingMode('SHARED')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              billingMode === 'SHARED'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
            }`}
          >
            <Users size={14} />
            <span>Shared Billing</span>
          </button>
        </div>
      </div>

      {/* Messages */}
      {errorMsg && (
        <div className="bg-rose-50 border-l-4 border-rose-500 p-4 rounded-r-lg flex items-center space-x-3 text-rose-800 text-sm">
          <AlertTriangle size={20} className="text-rose-600 flex-shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}
      {successMsg && (
        <div className="bg-emerald-50 border-l-4 border-emerald-500 p-4 rounded-r-lg flex items-center space-x-3 text-emerald-800 text-sm">
          <CheckCircle2 size={20} className="text-emerald-600 flex-shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* LEFT COLUMN: CUSTOMER & PRODUCT SELECTOR (5 Cols) */}
        <div className="lg:col-span-5 space-y-5">
          {billingMode === 'STANDARD' && (
          /* Customer Selection */
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-3">
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
              Select Customer Account *
            </label>
            <div className="flex gap-2 relative" ref={customerDropdownRef}>
              <div className="relative w-full">
                <button
                  type="button"
                  onClick={() => setCustomerDropdownOpen(!customerDropdownOpen)}
                  className="w-full bg-slate-50 hover:bg-slate-100 border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium flex items-center justify-between cursor-pointer transition text-left"
                >
                  <span className={selectedCustomer ? 'text-slate-900 font-semibold truncate' : 'text-slate-500'}>
                    {selectedCustomer 
                      ? `${selectedCustomer.name} ${selectedCustomer.mobile ? `(${selectedCustomer.mobile})` : ''}` 
                      : '-- Select Customer * --'}
                  </span>
                  <ChevronDown size={16} className={`text-slate-500 transition-transform duration-200 flex-shrink-0 ml-2 ${customerDropdownOpen ? 'rotate-180' : ''}`} />
                </button>

                {customerDropdownOpen && (
                  <div className="absolute top-full left-0 mt-1 w-full bg-white border border-slate-200 rounded-lg shadow-xl z-50 max-h-72 overflow-y-auto divide-y divide-slate-100 animate-in fade-in duration-100">
                    <div className="sticky top-0 bg-white p-2 border-b border-slate-100 z-10">
                      <div className="flex items-center space-x-2 bg-slate-50 border border-slate-200 rounded-md px-2.5 py-1.5">
                        <Search size={14} className="text-slate-400 shrink-0" />
                        <input
                          type="text"
                          autoFocus
                          placeholder="Search customer name or mobile..."
                          value={customerSearch}
                          onChange={(e) => setCustomerSearch(e.target.value)}
                          className="w-full bg-transparent text-xs text-slate-800 focus:outline-none"
                        />
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedCustomerId('');
                        setPointsToRedeem(0);
                        setUseAdvance(false);
                        setAdvanceUsed('');
                        setCustomerDropdownOpen(false);
                      }}
                      className="w-full text-left px-3 py-2 text-xs text-slate-500 hover:bg-slate-50 font-medium transition cursor-pointer"
                    >
                      -- Counter / Walk-in Customer --
                    </button>
                    {filteredDropdownCustomers.length === 0 ? (
                      <div className="p-3 text-center space-y-2">
                        <p className="text-xs text-slate-500">No matching customer found.</p>
                        {customerSearch.trim() && (
                          <button
                            type="button"
                            onClick={() => {
                              setNewCustName(customerSearch.trim());
                              setCustomerDropdownOpen(false);
                              setShowAddCustomerModal(true);
                            }}
                            className="inline-flex items-center space-x-1 text-xs font-bold text-blue-600 hover:text-blue-700 bg-blue-50 px-2.5 py-1 rounded"
                          >
                            <UserPlus size={13} />
                            <span>+ Add &ldquo;{customerSearch.trim()}&rdquo;</span>
                          </button>
                        )}
                      </div>
                    ) : (
                      filteredDropdownCustomers.map((c) => (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => {
                            setSelectedCustomerId(c.id);
                            setPointsToRedeem(0);
                            setUseAdvance(false);
                            setAdvanceUsed('');
                            setCustomerDropdownOpen(false);
                            setCustomerSearch('');
                          }}
                          className={`w-full text-left px-3 py-2.5 text-xs transition flex items-center justify-between cursor-pointer ${
                            selectedCustomerId === c.id
                              ? 'bg-blue-50 text-blue-900 font-bold'
                              : 'text-slate-800 hover:bg-slate-50'
                          }`}
                        >
                          <div className="truncate pr-2">
                            <span>{c.name}</span>
                            {c.mobile && <span className="text-slate-500 ml-1">({c.mobile})</span>}
                          </div>
                          <div className="flex items-center space-x-1.5 shrink-0">
                            {Number(c.advance_balance || 0) > 0 && (
                              <span className="text-[10px] font-bold font-data-mono bg-teal-50 text-teal-700 border border-teal-200 px-1.5 py-0.5 rounded">
                                Adv ₹{Number(c.advance_balance).toFixed(0)}
                              </span>
                            )}
                            {selectedCustomerId === c.id && <CheckCircle2 size={14} className="text-blue-600 flex-shrink-0" />}
                          </div>
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>

              <button
                type="button"
                onClick={() => setShowAddCustomerModal(true)}
                className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-3 py-2 rounded-lg border border-slate-300 transition flex items-center space-x-1 flex-shrink-0 text-xs font-semibold cursor-pointer"
              >
                <UserPlus size={16} />
                <span>+ New</span>
              </button>
            </div>

            {/* Customer Info Card & Customer Advance Controls if selected */}
            {selectedCustomer && (
              <div className="space-y-3">
                <div className="bg-slate-50 p-3.5 rounded-lg border border-slate-200 text-xs space-y-2 shadow-sm">
                  <div className="flex justify-between items-center border-b pb-1.5 font-bold text-slate-800">
                    <span>Customer Ledger & Balance</span>
                    <span className="text-[10px] bg-blue-100 text-blue-800 px-2 py-0.5 rounded font-semibold uppercase">Live DB Record</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-[11px]">
                    <div>
                      <span className="text-slate-500 block text-[10px]">Previous Outstanding:</span>
                      <span className={`font-bold ${prevOutstanding > 0 ? 'text-amber-700' : 'text-slate-700'}`}>
                        ₹{prevOutstanding.toFixed(2)}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-500 block text-[10px]">Available Advance:</span>
                      <span className="font-bold text-emerald-700">₹{(selectedCustomer.advance_balance || 0).toFixed(2)}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block text-[10px]">Loyalty Balance:</span>
                      <span className="font-bold text-purple-700">⭐ {selectedCustomer.loyalty_points || 0} Pts</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block text-[10px]">Est. Total Amount Due:</span>
                      <span className="font-extrabold text-blue-700">
                        ₹{(prevOutstanding + (useAdvance ? netDueForCurrentBill : roundedTotal)).toFixed(2)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* CUSTOMER ADVANCE CONTROL BOX */}
                <div className={`p-3.5 rounded-lg border text-xs space-y-2.5 transition shadow-sm ${selectedCustomer.advance_balance > 0 ? 'bg-blue-50/90 border-blue-200' : 'bg-slate-50 border-slate-200 opacity-60'
                  }`}>
                  <div className="flex items-center justify-between">
                    <label className="flex items-center space-x-2 font-bold text-slate-800 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={useAdvance}
                        disabled={selectedCustomer.advance_balance <= 0}
                        onChange={(e) => {
                          setUseAdvance(e.target.checked);
                          if (!e.target.checked) {
                            setAdvanceUsed('');
                          } else {
                            const maxUsable = Math.min(selectedCustomer.advance_balance, roundedTotal);
                            setAdvanceUsed(maxUsable > 0 ? maxUsable : '');
                          }
                        }}
                        className="rounded text-blue-600 focus:ring-blue-500 w-4 h-4"
                      />
                      <span>Use Customer Advance</span>
                    </label>
                    <span className="text-[11px] font-semibold text-slate-600">
                      Available: <strong className="text-emerald-700 font-mono">₹{selectedCustomer.advance_balance.toFixed(2)}</strong>
                    </span>
                  </div>

                  {useAdvance && (
                    <div className="space-y-2 pt-2 border-t border-blue-200/80">
                      <div className="flex items-center justify-between gap-2">
                        <label className="text-[11px] font-bold text-slate-700">Advance Amount to Apply (₹):</label>
                        <input
                          type="number"
                          min="0"
                          step="any"
                          max={Math.min(selectedCustomer.advance_balance, roundedTotal)}
                          placeholder="0.00"
                          value={advanceUsed}
                          onChange={(e) => setAdvanceUsed(e.target.value === '' ? '' : Math.max(0, Number(e.target.value)))}
                          className="w-28 text-right bg-white border border-slate-300 rounded px-2.5 py-1 text-xs font-bold text-slate-900 focus:ring-1 focus:ring-blue-500 shadow-inner"
                        />
                      </div>

                      {/* Live Remaining Advance Feedback */}
                      <div className="flex justify-between items-center text-[11px] text-slate-600 font-medium">
                        <span>Remaining Advance Balance:</span>
                        <span className="font-extrabold text-blue-700 font-data-mono">
                          ₹{Math.max(0, selectedCustomer.advance_balance - Number(advanceUsed || 0)).toFixed(2)}
                        </span>
                      </div>

                      {/* Real-time Validation Errors */}
                      {Number(advanceUsed || 0) > selectedCustomer.advance_balance && (
                        <p className="text-[10px] font-bold text-rose-700 bg-rose-50 p-2 rounded border border-rose-200">
                          ⚠️ Advance amount cannot exceed the customer&apos;s available advance balance (₹{selectedCustomer.advance_balance.toFixed(2)}).
                        </p>
                      )}
                      {Number(advanceUsed || 0) > roundedTotal && Number(advanceUsed || 0) <= selectedCustomer.advance_balance && (
                        <p className="text-[10px] font-bold text-rose-700 bg-rose-50 p-2 rounded border border-rose-200">
                          ⚠️ Advance amount cannot exceed the current bill amount (₹{roundedTotal.toFixed(2)}).
                        </p>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
          )}

          {billingMode === 'SPLIT' && (
            /* SPLIT BILLING: MULTI-CUSTOMER PICKER */
            <div className="bg-white p-5 rounded-xl border border-amber-200 shadow-sm space-y-3.5">
              <div className="flex items-center justify-between">
                <div>
                  <label className="block text-xs font-bold text-amber-900 uppercase tracking-wider">
                    Select Customers for Split Billing *
                  </label>
                  <p className="text-[11px] text-slate-500 mt-0.5">Purchasing identical items ({splitSelectedCustomerIds.length} selected)</p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowAddCustomerModal(true)}
                  className="bg-amber-50 hover:bg-amber-100 text-amber-800 px-2.5 py-1 rounded-lg border border-amber-200 transition flex items-center space-x-1 text-xs font-semibold cursor-pointer"
                >
                  <UserPlus size={14} />
                  <span>+ New</span>
                </button>
              </div>

              {/* Selected Customer Badges */}
              {splitSelectedCustomerIds.length > 0 && (
                <div className="flex flex-wrap gap-1.5 p-2 bg-amber-50/50 rounded-lg border border-amber-100 max-h-32 overflow-y-auto">
                  {splitSelectedCustomerIds.map(cid => {
                    const cust = customers.find(c => c.id === cid);
                    if (!cust) return null;
                    return (
                      <span key={cid} className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-white border border-amber-200 rounded-lg text-xs font-medium text-slate-800 shadow-2xs">
                        <span>{cust.name}</span>
                        {Number(cust.advance_balance || 0) > 0 && (
                          <span className="text-[10px] bg-teal-100 text-teal-800 font-bold px-1 rounded">Adv ₹{Number(cust.advance_balance).toFixed(0)}</span>
                        )}
                        <button
                          type="button"
                          onClick={() => handleToggleSplitCustomer(cid)}
                          className="text-slate-400 hover:text-rose-600 font-bold ml-0.5 cursor-pointer"
                        >
                          &times;
                        </button>
                      </span>
                    );
                  })}
                </div>
              )}

              {/* Customer Search & Quick Toggle List */}
              <div className="space-y-2">
                <div className="flex items-center space-x-2 bg-slate-50 border border-slate-200 rounded-md px-2.5 py-1.5">
                  <Search size={14} className="text-slate-400 shrink-0" />
                  <input
                    type="text"
                    placeholder="Search customer name or mobile..."
                    value={splitCustomerSearch}
                    onChange={(e) => setSplitCustomerSearch(e.target.value)}
                    className="w-full bg-transparent text-xs text-slate-800 focus:outline-none"
                  />
                </div>

                <div className="max-h-52 overflow-y-auto divide-y divide-slate-100 border border-slate-200 rounded-lg">
                  {customers
                    .filter(c => 
                      c.name.toLowerCase().includes(splitCustomerSearch.trim().toLowerCase()) ||
                      (c.mobile && c.mobile.includes(splitCustomerSearch.trim()))
                    )
                    .map(c => {
                      const isSelected = splitSelectedCustomerIds.includes(c.id);
                      return (
                        <div
                          key={c.id}
                          onClick={() => handleToggleSplitCustomer(c.id)}
                          className={`p-2.5 text-xs flex items-center justify-between cursor-pointer transition ${
                            isSelected ? 'bg-amber-50/80 font-bold text-amber-950' : 'hover:bg-slate-50 text-slate-700'
                          }`}
                        >
                          <div className="flex items-center gap-2 truncate pr-2">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => {}}
                              className="rounded text-amber-600 focus:ring-amber-500 cursor-pointer"
                            />
                            <span className="truncate">{c.name}</span>
                            {c.mobile && <span className="text-slate-400 font-normal">({c.mobile})</span>}
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0">
                            {Number(c.advance_balance || 0) > 0 && (
                              <span className="text-[10px] font-bold bg-teal-50 text-teal-700 border border-teal-200 px-1.5 py-0.5 rounded">
                                Adv: ₹{Number(c.advance_balance).toFixed(0)}
                              </span>
                            )}
                            {isSelected && <Check size={14} className="text-amber-600" />}
                          </div>
                        </div>
                      );
                    })}
                </div>
              </div>
            </div>
          )}

          {billingMode === 'SHARED' && (
            /* SHARED BILLING: PARTICIPANTS MANAGER */
            <div className="bg-white p-5 rounded-xl border border-emerald-200 shadow-sm space-y-3.5">
              <div className="flex items-center justify-between">
                <div>
                  <label className="block text-xs font-bold text-emerald-900 uppercase tracking-wider">
                    Group Participants ({sharedParticipants.length})
                  </label>
                  <p className="text-[11px] text-slate-500 mt-0.5">Divide combined bill amount equally or custom</p>
                </div>
                {sharedParticipants.length > 0 && (
                  <button
                    type="button"
                    onClick={() => autoRecalculateEqualSplit(sharedParticipants)}
                    className="bg-emerald-50 hover:bg-emerald-100 text-emerald-800 px-2.5 py-1 rounded-lg border border-emerald-200 transition text-xs font-bold flex items-center gap-1 cursor-pointer"
                    title="Auto divide total equally among participants"
                  >
                    <Calculator size={13} />
                    <span>Divide Equally (1/N)</span>
                  </button>
                )}
              </div>

              {/* Add Participant: Registered Customer or Guest */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 border-t border-slate-100">
                {/* Option A: Select Registered Customer */}
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">Add Registered Member</label>
                  <select
                    value={sharedSelectedCustIdToAdd}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val) handleAddSharedRegisteredParticipant(val);
                    }}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 focus:ring-1 focus:ring-emerald-500"
                  >
                    <option value="">-- Choose Customer --</option>
                    {customers
                      .filter(c => !sharedParticipants.some(p => p.customer_id === c.id))
                      .map(c => (
                        <option key={c.id} value={c.id}>
                          {c.name} {c.advance_balance > 0 ? `(Adv: ₹${c.advance_balance})` : ''}
                        </option>
                      ))}
                  </select>
                </div>

                {/* Option B: Quick Add Guest / Walk-in */}
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">Or Add Guest / Walk-in</label>
                  <div className="flex gap-1.5">
                    <input
                      type="text"
                      placeholder="e.g. Guest 1 / Friend"
                      value={sharedNewGuestName}
                      onChange={(e) => setSharedNewGuestName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleAddSharedGuestParticipant();
                        }
                      }}
                      className="w-full bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 focus:ring-1 focus:ring-emerald-500"
                    />
                    <button
                      type="button"
                      onClick={handleAddSharedGuestParticipant}
                      disabled={!sharedNewGuestName.trim()}
                      className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold disabled:opacity-40 shrink-0 cursor-pointer"
                    >
                      + Add
                    </button>
                  </div>
                </div>
              </div>

              {/* Participants List */}
              {sharedParticipants.length === 0 ? (
                <div className="p-4 text-center bg-slate-50 rounded-lg border border-dashed border-slate-200 text-xs text-slate-500">
                  No participants added yet. Add group members above to split the bill amount.
                </div>
              ) : (
                <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                  {sharedParticipants.map((part, pIdx) => {
                    const cust = part.customer_id ? customers.find(c => c.id === part.customer_id) : null;
                    const isRegistered = Boolean(part.customer_id);
                    return (
                      <div key={part.id} className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2 text-xs">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5">
                            <span className="font-bold text-slate-900">{isRegistered ? cust?.name : `${part.guest_name} (Guest)`}</span>
                            {isRegistered && cust && cust.advance_balance > 0 && (
                              <span className="text-[10px] font-bold bg-teal-100 text-teal-800 px-1.5 py-0.2 rounded">
                                Adv ₹{cust.advance_balance}
                              </span>
                            )}
                          </div>
                          <button
                            type="button"
                            onClick={() => handleRemoveSharedParticipant(part.id)}
                            className="text-slate-400 hover:text-rose-600 p-0.5 cursor-pointer"
                            title="Remove member"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>

                        {/* Share Amount Input & Payer selector */}
                        <div className="grid grid-cols-2 gap-2 text-[11px]">
                          <div>
                            <label className="text-[10px] font-semibold text-slate-500 block mb-0.5">Share Amount (₹)</label>
                            <input
                              type="number"
                              min="0"
                              step="any"
                              value={part.share_amount === 0 ? '' : part.share_amount}
                              onChange={(e) => {
                                const val = Math.max(0, Number(e.target.value));
                                setSharedParticipants(prev => prev.map((item, idx) => idx === pIdx ? { ...item, share_amount: val } : item));
                              }}
                              className="w-full bg-white border border-slate-300 rounded px-2 py-1 font-bold text-slate-900 focus:ring-1 focus:ring-emerald-500"
                            />
                          </div>


                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Catalog Products */}
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                Shop Product Catalog
              </label>
              <span className="text-xs text-slate-400">{products.length} items</span>
            </div>

            <div className="flex gap-2 items-center">
              <div className="relative flex-1">
                <Search size={16} className="absolute left-3 top-2.5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search products or category..."
                  value={productSearch}
                  onChange={(e) => setProductSearch(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="flex items-center space-x-1 bg-slate-50 border border-slate-300 rounded-lg px-2 py-1">
                <span className="text-[10px] font-bold text-slate-500 uppercase">Qty</span>
                <input
                  type="number"
                  min="0.01"
                  step="any"
                  value={catalogQty}
                  onChange={(e) => setCatalogQty(e.target.value === '' ? '' : Number(e.target.value))}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && filteredProducts.length > 0) {
                      e.preventDefault();
                      handleAddProductToCart(filteredProducts[0]);
                    }
                  }}
                  title="Quantity to add when clicking or pressing Enter on catalog product"
                  className="w-12 bg-white border border-slate-200 rounded px-1.5 py-1 text-xs font-bold text-center text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
            </div>

            <div className="max-h-48 overflow-y-auto space-y-1 pr-1">
              {filteredProducts.length === 0 ? (
                <p className="text-xs text-slate-400 p-2 text-center">No products found.</p>
              ) : (
                filteredProducts.map((prod) => (
                  <div
                    key={prod.id}
                    onClick={() => handleAddProductToCart(prod)}
                    className="flex items-center justify-between p-2 hover:bg-blue-50 rounded-lg cursor-pointer transition border border-transparent hover:border-blue-100"
                  >
                    <div>
                      <p className="text-xs font-semibold text-slate-800">{prod.name}</p>
                      <p className="text-[10px] text-slate-400">{prod.category}</p>
                    </div>
                    <span className="text-xs font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded">
                      + ₹{prod.price}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Quick Custom Entry with Predictive Autocomplete & 1-Click Presets */}
          <form onSubmit={handleAddCustomItem} className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                Quick Custom Entry (Xerox / Printing)
              </label>
              <span className="text-[10px] font-semibold bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-full border border-emerald-100">
                Instant Auto-Suggest
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <div className="sm:col-span-3 relative" ref={customDropdownRef}>
                <input
                  ref={customInputRef}
                  type="text"
                  placeholder="Type item name (e.g. A4 Color Copy, Spiral)..."
                  value={customItemName}
                  onFocus={() => setCustomDropdownOpen(true)}
                  onChange={(e) => {
                    setCustomItemName(e.target.value);
                    setCustomDropdownOpen(true);
                    setCustomHighlightedIndex(-1);
                  }}
                  onKeyDown={handleCustomInputKeyDown}
                  className="w-full bg-slate-50 border border-slate-300 rounded px-2.5 py-1.5 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white"
                />

                {/* Autocomplete Dropdown */}
                {customDropdownOpen && customSuggestions.length > 0 && (
                  <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-slate-200 rounded-lg shadow-xl z-30 max-h-56 overflow-y-auto divide-y divide-slate-100">
                    <div className="px-2.5 py-1 bg-slate-50 text-[10px] font-bold text-slate-400 uppercase tracking-wider flex justify-between items-center">
                      <span>Matching Items</span>
                      <span>Press Enter to Add</span>
                    </div>
                    {customSuggestions.map((item, idx) => {
                      const isHighlighted = idx === customHighlightedIndex;
                      return (
                        <div
                          key={item.id}
                          onMouseEnter={() => setCustomHighlightedIndex(idx)}
                          onClick={() => handleSelectCustomSuggestion(item)}
                          className={`px-3 py-2 text-xs flex items-center justify-between cursor-pointer transition ${
                            isHighlighted ? 'bg-blue-50 text-blue-900 font-semibold' : 'text-slate-800 hover:bg-slate-50'
                          }`}
                        >
                          <div className="flex items-center gap-1.5 min-w-0">
                            <span className="truncate">{item.name}</span>
                            <span className={`px-1.5 py-0.2 rounded text-[9px] font-bold uppercase shrink-0 ${
                              item.source === 'catalog' 
                                ? 'bg-blue-100 text-blue-700' 
                                : 'bg-amber-100 text-amber-800'
                            }`}>
                              {item.source === 'catalog' ? 'Catalog' : 'Saved'}
                            </span>
                          </div>
                          <div className="text-right shrink-0 ml-2">
                            <span className="font-mono font-bold text-slate-900">₹{item.price.toFixed(2)}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
              <div>
                <label className="text-[10px] text-slate-400 font-semibold block">Qty</label>
                <input
                  type="number"
                  step="any"
                  min="0.01"
                  value={customItemQty}
                  onChange={(e) => setCustomItemQty(e.target.value === '' ? '' : Number(e.target.value))}
                  className="w-full bg-slate-50 border border-slate-300 rounded px-2 py-1 text-xs text-center font-data-mono font-bold"
                />
              </div>
              <div>
                <label className="text-[10px] text-slate-400 font-semibold block">Unit Rate (₹)</label>
                <input
                  type="number"
                  step="any"
                  min="0"
                  placeholder="0.00"
                  value={customItemPrice}
                  onChange={(e) => setCustomItemPrice(e.target.value === '' ? '' : Number(e.target.value))}
                  className="w-full bg-slate-50 border border-slate-300 rounded px-2 py-1 text-xs text-center font-data-mono font-bold"
                />
              </div>
              <div className="flex items-end">
                <button
                  type="submit"
                  className="w-full bg-slate-800 hover:bg-slate-700 text-white font-semibold text-xs py-1.5 rounded transition flex items-center justify-center space-x-1"
                >
                  <Plus size={14} />
                  <span>Add Item</span>
                </button>
              </div>
            </div>
          </form>
        </div>

        {/* RIGHT COLUMN: BILL CART & TOTALS & SPLIT PAYMENTS (7 Cols) */}
        <div className="lg:col-span-7 bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-5 flex flex-col justify-between">
          <div>
            <div className="flex justify-between items-center pb-3 border-b border-slate-200">
              <h2 className="font-bold text-slate-900 text-base">Current Bill Items</h2>
              <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded font-mono">
                {cart.length} items
              </span>
            </div>

            {/* CART ITEMS TABLE WITH EDITABLE UNIT RATE */}
            {cart.length === 0 ? (
              <div className="py-12 text-center text-slate-400 text-xs">
                No items added to bill yet. Click products from catalog or use quick custom entry.
              </div>
            ) : (
              <div className="divide-y divide-slate-100 max-h-56 overflow-y-auto">
                {cart.map((item, idx) => (
                  <div key={idx} className="py-2.5 flex items-center justify-between gap-2 text-xs">
                    <div className="flex-1">
                      <p className="font-semibold text-slate-800">{item.product_name}</p>

                      {/* EDITABLE UNIT RATE INPUT */}
                      <div className="flex items-center space-x-1 text-[10px] text-slate-500 mt-0.5">
                        <span>Rate: ₹</span>
                        <input
                          type="number"
                          min="0"
                          step="any"
                          value={item.price}
                          onChange={(e) => handleUpdateItemRate(idx, Number(e.target.value))}
                          className="w-16 bg-slate-50 border border-slate-300 rounded px-1 py-0.5 text-[10px] font-bold text-slate-900 focus:outline-none focus:ring-1 focus:ring-blue-500"
                        />
                        {!item.product_id && (
                          <button
                            type="button"
                            onClick={() => handleSaveCustomItemToCatalog(item)}
                            className="ml-2 text-[9px] font-bold text-blue-600 hover:text-blue-800 underline cursor-pointer"
                            title="Save this custom item to permanent inventory catalog"
                          >
                            + Save to Catalog
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center space-x-1">
                      <button
                        type="button"
                        onClick={() => handleUpdateItemQty(idx, item.isDecimal ? Math.max(0, Number((item.quantity - 1).toFixed(2))) : item.quantity - 1)}
                        className="w-5 h-5 bg-slate-100 hover:bg-slate-200 rounded text-slate-700 font-bold flex items-center justify-center text-xs"
                        title="Decrease quantity"
                      >
                        -
                      </button>
                      <input
                        type="number"
                        min="0"
                        step={item.isDecimal ? "any" : "1"}
                        value={item.quantity}
                        onChange={(e) => {
                          const val = e.target.value;
                          if (val === '') {
                            handleUpdateItemQty(idx, 0);
                          } else {
                            handleUpdateItemQty(idx, Number(val));
                          }
                        }}
                        className="w-14 bg-slate-50 border border-slate-300 rounded px-1 py-0.5 text-xs font-bold text-center text-slate-900 focus:outline-none focus:ring-1 focus:ring-blue-500 font-data-mono"
                        title="Type quantity using keyboard"
                      />
                      <button
                        type="button"
                        onClick={() => handleUpdateItemQty(idx, item.isDecimal ? Number((item.quantity + 1).toFixed(2)) : item.quantity + 1)}
                        className="w-5 h-5 bg-slate-100 hover:bg-slate-200 rounded text-slate-700 font-bold flex items-center justify-center text-xs"
                        title="Increase quantity"
                      >
                        +
                      </button>
                      <button
                        type="button"
                        onClick={() => handleToggleItemDecimal(idx)}
                        className={`text-[9px] px-1 py-0.5 rounded font-mono font-bold transition ml-0.5 ${
                          item.isDecimal
                            ? 'bg-blue-100 text-blue-700 border border-blue-300'
                            : 'bg-slate-100 text-slate-400 hover:text-slate-600 border border-slate-200'
                        }`}
                        title={item.isDecimal ? "Decimal mode enabled (.00). Click for whole number mode." : "Click to allow decimal quantity (e.g. 1.5)"}
                      >
                        {item.isDecimal ? '.00' : '#'}
                      </button>
                    </div>

                    <span className="w-16 text-right font-extrabold text-slate-900">
                      ₹{item.total.toFixed(2)}
                    </span>

                    <button
                      onClick={() => handleRemoveItem(idx)}
                      className="text-slate-400 hover:text-rose-500 p-1"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* STANDARD BILLING RIGHT COLUMN */}
          {billingMode === 'STANDARD' && (
            <div className="space-y-5">
              {/* TOTALS & DISCOUNTS & ROUNDING */}
              <div className="border-t border-slate-200 pt-4 space-y-3 bg-slate-50 p-4 rounded-xl">
            <div className="flex justify-between items-center text-xs">
              <span className="text-slate-600">Subtotal:</span>
              <span className="font-bold text-slate-900">₹{subtotal.toFixed(2)}</span>
            </div>

            {/* DISCOUNT TYPE SELECTOR (FLAT ₹ vs PERCENTAGE %) */}
            <div className="flex justify-between items-center text-xs">
              <div className="flex items-center space-x-2">
                <span className="text-slate-600 font-medium">Discount:</span>
                <div className="bg-white border border-slate-300 rounded p-0.5 flex">
                  <button
                    type="button"
                    onClick={() => setDiscountType('FLAT')}
                    className={`px-2 py-0.5 rounded text-[10px] font-bold transition ${discountType === 'FLAT' ? 'bg-blue-600 text-white shadow' : 'text-slate-600 hover:bg-slate-100'
                      }`}
                  >
                    Flat ₹
                  </button>
                  <button
                    type="button"
                    onClick={() => setDiscountType('PERCENTAGE')}
                    className={`px-2 py-0.5 rounded text-[10px] font-bold transition flex items-center space-x-0.5 ${discountType === 'PERCENTAGE' ? 'bg-blue-600 text-white shadow' : 'text-slate-600 hover:bg-slate-100'
                      }`}
                  >
                    <span>Percent</span>
                    <Percent size={10} />
                  </button>
                </div>
              </div>

              <div className="flex items-center space-x-1">
                <input
                  type="number"
                  min="0"
                  step="any"
                  max={discountType === 'PERCENTAGE' ? 100 : undefined}
                  placeholder="0"
                  value={discountValue === 0 ? '' : discountValue}
                  onChange={(e) => setDiscountValue(Math.max(0, Number(e.target.value)))}
                  className="w-24 text-right bg-white border border-slate-300 rounded px-2 py-1 text-xs font-bold text-slate-900 focus:ring-1 focus:ring-blue-500"
                />
                <span className="text-xs font-bold text-slate-500 w-4">
                  {discountType === 'FLAT' ? '₹' : '%'}
                </span>
              </div>
            </div>

            {/* Calculated Discount Feedback */}
            {discountType === 'PERCENTAGE' && discountValue > 0 && (
              <div className="flex justify-between text-xs text-blue-700 font-bold bg-blue-50 px-2 py-1 rounded">
                <span>Calculated {discountValue}% Discount:</span>
                <span>-₹{manualDiscountApplied.toFixed(2)}</span>
              </div>
            )}

            {/* Dynamic Active Redemption Rules Selector & Points Input */}
            {selectedCustomer && selectedCustomer.loyalty_points > 0 && settings?.loyalty.enabled && (
              <div className="space-y-2 bg-purple-50 p-3 rounded-lg border border-purple-200">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-purple-900 font-bold flex items-center space-x-1">
                    <Gift size={14} />
                    <span>Redeem Loyalty Points:</span>
                  </span>
                  <input
                    type="number"
                    min="0"
                    max={selectedCustomer.loyalty_points}
                    value={pointsToRedeem === 0 ? '' : pointsToRedeem}
                    onChange={(e) => {
                      const inputPts = Math.max(0, Number(e.target.value));
                      setPointsToRedeem(Math.min(selectedCustomer.loyalty_points, inputPts));
                    }}
                    className="w-20 text-right bg-white border border-purple-300 rounded px-2 py-1 text-xs font-extrabold text-purple-900 focus:ring-1 focus:ring-purple-500"
                  />
                </div>

                {/* Quick Active Redemption Rules Buttons */}
                {activeRedemptionRules.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {activeRedemptionRules.map((rRule) => (
                      <button
                        key={rRule.id}
                        type="button"
                        onClick={() => {
                          if (selectedCustomer.loyalty_points >= rRule.points_required) {
                            setPointsToRedeem(rRule.points_required);
                          }
                        }}
                        disabled={selectedCustomer.loyalty_points < rRule.points_required}
                        className={`text-[10px] px-2 py-1 rounded font-bold transition border ${pointsToRedeem === rRule.points_required
                            ? 'bg-purple-700 text-white border-purple-800'
                            : selectedCustomer.loyalty_points >= rRule.points_required
                              ? 'bg-white text-purple-800 border-purple-300 hover:bg-purple-100'
                              : 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed'
                          }`}
                      >
                        {rRule.points_required} Pts = ₹{rRule.discount_amount}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* REAL-TIME LOYALTY LIVE DISPLAY WIDGET */}
            {selectedCustomer && settings?.loyalty.enabled && (
              <div className="bg-purple-900 text-white p-3.5 rounded-lg text-xs space-y-2 shadow">
                <div className="flex justify-between items-center border-b border-purple-800 pb-1.5 font-bold">
                  <span className="flex items-center space-x-1 text-purple-200">
                    <Sparkles size={14} />
                    <span>Loyalty Engine</span>
                  </span>
                  <span className={`font-mono font-bold ${remainingBillBalance === 0 ? 'text-emerald-400' : 'text-amber-300'}`}>
                    {cart.length === 0 || roundedTotal === 0
                      ? '🎁 +0 pts'
                      : (remainingBillBalance === 0
                        ? `🎁 +${estimatedPointsEarned} pts Earned`
                        : `⏳ +${estimatedPointsEarned} pts On Full Pay`)}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-[11px]">
                  <div>
                    <span className="text-purple-300 block">Current Loyalty Points:</span>
                    <span className="font-extrabold">{selectedCustomer.loyalty_points} Points</span>
                  </div>
                  <div>
                    <span className="text-purple-300 block">Discount Applied:</span>
                    <span className="font-extrabold text-emerald-300">-₹{loyaltyDiscount.toFixed(2)}</span>
                  </div>
                  <div>
                    <span className="text-purple-300 block">Points Redeemed:</span>
                    <span className="font-extrabold">{pointsToRedeem} Points</span>
                  </div>
                  <div>
                    <span className="text-purple-300 block">Estimated Balance:</span>
                    <span className="font-extrabold text-purple-200">
                      {Math.max(0, selectedCustomer.loyalty_points - pointsToRedeem + (remainingBillBalance === 0 ? estimatedPointsEarned : 0))} Points
                    </span>
                  </div>
                  <div className="col-span-2 pt-1.5 border-t border-purple-800/80 flex justify-between items-center">
                    <span className="text-purple-300 font-semibold flex items-center space-x-1">
                      <Clock size={12} className="text-amber-400" />
                      <span>Pending Uncredited Points:</span>
                    </span>
                    <span className="font-extrabold text-amber-300 font-mono">
                      ⏳ {totalPendingPoints} Points
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* GST Row (If Enabled in Settings) */}
            {settings?.billing?.gst_enabled && Number(settings?.billing?.gst_rate) > 0 && (
              <div className="flex justify-between items-center text-xs text-slate-700 font-medium">
                <span>GST ({settings.billing.gst_rate}%):</span>
                <span className="text-blue-700 font-bold">+₹{gstAmount.toFixed(2)}</span>
              </div>
            )}

            {/* Rounding Selection */}
            <div className="flex justify-between items-center text-xs">
              <span className="text-slate-600 flex items-center space-x-1">
                <Calculator size={14} />
                <span>Rounding Method:</span>
              </span>
              <select
                value={roundingMethod}
                onChange={(e) => setRoundingMethod(e.target.value as RoundingMethod)}
                className="bg-white border border-slate-300 rounded px-2 py-1 text-xs font-semibold text-slate-800"
              >
                <option value="None">No Rounding</option>
                <option value="Round Down">Round Down</option>
                <option value="Round Up">Round Up</option>
                <option value="Standard">Standard Rounding</option>
              </select>
            </div>

            {roundingAdjustment !== 0 && (
              <div className="flex justify-between text-xs text-slate-500 italic">
                <span>Rounding Adjustment:</span>
                <span>{roundingAdjustment >= 0 ? '+' : ''}₹{roundingAdjustment.toFixed(2)}</span>
              </div>
            )}

            <div className="flex justify-between items-center text-lg font-extrabold text-slate-900 pt-2 border-t border-slate-200">
              <span>Grand Total:</span>
              <span className="text-blue-700 text-xl">₹{roundedTotal.toFixed(2)}</span>
            </div>

            {/* EXPLICIT PAYMENT MODE SELECTOR TABS */}
            <div className="pt-2 border-t border-slate-200 space-y-3">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide">
                  Payment Mode
                </label>
                {paymentMode === 'Split' && (
                  <span className="text-[11px] font-semibold text-purple-700 bg-purple-100 px-2 py-0.5 rounded">
                    Cash + UPI Breakdown
                  </span>
                )}
              </div>

              {/* Mode Tabs */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 p-1 bg-slate-100 rounded-lg">
                <button
                  type="button"
                  onClick={() => handleSelectPaymentMode('Cash')}
                  className={`py-2 px-2 rounded-md text-xs font-bold transition flex items-center justify-center space-x-1.5 ${
                    paymentMode === 'Cash'
                      ? 'bg-emerald-600 text-white shadow'
                      : 'text-slate-700 hover:bg-white/80'
                  }`}
                >
                  <Banknote size={15} />
                  <span>Cash</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleSelectPaymentMode('UPI')}
                  className={`py-2 px-2 rounded-md text-xs font-bold transition flex items-center justify-center space-x-1.5 ${
                    paymentMode === 'UPI'
                      ? 'bg-indigo-600 text-white shadow'
                      : 'text-slate-700 hover:bg-white/80'
                  }`}
                >
                  <Smartphone size={15} />
                  <span>UPI</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleSelectPaymentMode('Split')}
                  className={`py-2 px-2 rounded-md text-xs font-bold transition flex items-center justify-center space-x-1.5 ${
                    paymentMode === 'Split'
                      ? 'bg-purple-600 text-white shadow'
                      : 'text-slate-700 hover:bg-white/80'
                  }`}
                >
                  <Split size={15} />
                  <span>Split</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleSelectPaymentMode('Pay Later')}
                  className={`py-2 px-2 rounded-md text-xs font-bold transition flex items-center justify-center space-x-1.5 ${
                    paymentMode === 'Pay Later'
                      ? 'bg-amber-600 text-white shadow'
                      : 'text-slate-700 hover:bg-white/80'
                  }`}
                >
                  <Clock size={15} />
                  <span>Pay Later</span>
                </button>
              </div>

              {/* ADVANCE OPTION / TAB IF CUSTOMER HAS ADVANCE */}
              {selectedCustomer && selectedCustomer.advance_balance > 0 && (
                <button
                  type="button"
                  onClick={() => handleSelectPaymentMode('Advance')}
                  className={`w-full py-1.5 px-3 rounded-lg text-xs font-bold transition flex items-center justify-between border ${
                    paymentMode === 'Advance'
                      ? 'bg-teal-600 text-white border-teal-700 shadow'
                      : 'bg-teal-50 text-teal-800 border-teal-200 hover:bg-teal-100'
                  }`}
                >
                  <span className="flex items-center space-x-1.5">
                    <Sparkles size={14} />
                    <span>Pay with Advance Balance</span>
                  </span>
                  <span className="font-mono">Available: ₹{selectedCustomer.advance_balance.toFixed(2)}</span>
                </button>
              )}

              {/* TAB CONTENT PANELS */}
              {paymentMode === 'Cash' && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-xs space-y-2">
                  <div className="flex justify-between items-center text-emerald-900 font-bold">
                    <span>{advanceVal > 0 ? 'Net Cash to Collect:' : 'Full Cash Payment:'}</span>
                    <span className="text-base font-extrabold font-mono">₹{netDueForCurrentBill.toFixed(2)}</span>
                  </div>
                  {advanceVal > 0 && (
                    <div className="flex justify-between items-center text-[11px] text-teal-800 font-medium bg-teal-100/60 px-2 py-1 rounded">
                      <span>Total Bill: ₹{roundedTotal.toFixed(2)}</span>
                      <span className="font-bold text-teal-900">• Less Advance: -₹{advanceVal.toFixed(2)}</span>
                    </div>
                  )}
                  <div className="flex items-center justify-between pt-1 border-t border-emerald-200/60 text-slate-600">
                    <span className="text-[11px]">Tendered Amount (Optional):</span>
                    <input
                      type="number"
                      min="0"
                      step="any"
                      placeholder={`e.g. ${netDueForCurrentBill}`}
                      value={cashPaid === '' ? '' : cashPaid}
                      onChange={(e) => setCashPaid(e.target.value === '' ? '' : Number(e.target.value))}
                      className="w-24 text-right bg-white border border-emerald-300 rounded px-2 py-0.5 text-xs font-bold text-slate-900 focus:ring-1 focus:ring-emerald-500"
                    />
                  </div>
                  {Number(cashPaid || 0) > netDueForCurrentBill && (
                    <div className="bg-indigo-50/90 border border-indigo-200 p-2.5 rounded-lg space-y-1 text-xs">
                      <div className="flex justify-between items-center text-indigo-950 font-bold">
                        <span>Excess Paid:</span>
                        <span className="font-mono font-extrabold text-indigo-700">₹{(Number(cashPaid) - netDueForCurrentBill).toFixed(2)}</span>
                      </div>
                      {allocatedToPriorBalance > 0 && (
                        <div className="flex justify-between items-center text-[11px] text-amber-800">
                          <span>• Applied to Clear Past Dues:</span>
                          <span className="font-mono font-bold">₹{allocatedToPriorBalance.toFixed(2)}</span>
                        </div>
                      )}
                      {customerAdvanceEarned > 0 && (
                        <div className="flex justify-between items-center text-[11px] text-indigo-800 font-bold">
                          <span>• Added to Customer Advance:</span>
                          <span className="font-mono">+₹{customerAdvanceEarned.toFixed(2)}</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {paymentMode === 'UPI' && (
                <div className="p-3 bg-indigo-50 border border-indigo-200 rounded-lg text-xs space-y-2">
                  <div className="flex justify-between items-center text-indigo-900 font-bold">
                    <span>{advanceVal > 0 ? 'Net UPI to Collect:' : 'Full UPI Payment:'}</span>
                    <span className="text-base font-extrabold font-mono">₹{netDueForCurrentBill.toFixed(2)}</span>
                  </div>
                  {advanceVal > 0 && (
                    <div className="flex justify-between items-center text-[11px] text-teal-800 font-medium bg-teal-100/60 px-2 py-1 rounded">
                      <span>Total Bill: ₹{roundedTotal.toFixed(2)}</span>
                      <span className="font-bold text-teal-900">• Less Advance: -₹{advanceVal.toFixed(2)}</span>
                    </div>
                  )}
                  <div className="flex items-center justify-between pt-1 border-t border-indigo-200/60 text-slate-600">
                    <span className="text-[11px]">UPI Paid Amount:</span>
                    <input
                      type="number"
                      min="0"
                      step="any"
                      value={upiPaid === '' ? '' : upiPaid}
                      onChange={(e) => setUpiPaid(e.target.value === '' ? '' : Number(e.target.value))}
                      className="w-24 text-right bg-white border border-indigo-300 rounded px-2 py-0.5 text-xs font-bold text-slate-900 focus:ring-1 focus:ring-indigo-500"
                    />
                  </div>
                </div>
              )}

              {paymentMode === 'Split' && (
                <div className="p-3 bg-purple-50 border border-purple-200 rounded-lg text-xs space-y-3">
                  {advanceVal > 0 && (
                    <div className="flex justify-between items-center text-[11px] text-teal-800 font-medium bg-teal-100/60 px-2 py-1 rounded">
                      <span>Total Bill: ₹{roundedTotal.toFixed(2)}</span>
                      <span className="font-bold text-teal-900">• Less Advance: -₹{advanceVal.toFixed(2)} (Net: ₹{netDueForCurrentBill.toFixed(2)})</span>
                    </div>
                  )}
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[11px] font-bold text-slate-700 block mb-1">Cash (₹)</label>
                      <input
                        type="number"
                        min="0"
                        step="any"
                        placeholder="0"
                        value={cashPaid}
                        onChange={(e) => setCashPaid(e.target.value === '' ? '' : Number(e.target.value))}
                        className="w-full bg-white border border-slate-300 rounded px-2 py-1.5 text-xs font-bold text-slate-900 focus:ring-1 focus:ring-purple-500"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-bold text-slate-700 block mb-1">UPI (₹)</label>
                      <input
                        type="number"
                        min="0"
                        step="any"
                        placeholder="0"
                        value={upiPaid}
                        onChange={(e) => setUpiPaid(e.target.value === '' ? '' : Number(e.target.value))}
                        className="w-full bg-white border border-slate-300 rounded px-2 py-1.5 text-xs font-bold text-slate-900 focus:ring-1 focus:ring-purple-500"
                      />
                    </div>
                  </div>

                  {/* Auto Split Helper Buttons */}
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    <button
                      type="button"
                      onClick={() => {
                        const target = netDueForCurrentBill;
                        const half = Math.round((target / 2) * 100) / 100;
                        setCashPaid(half);
                        setUpiPaid(Math.round((target - half) * 100) / 100);
                      }}
                      className="text-[10px] bg-white border border-purple-300 text-purple-700 hover:bg-purple-100 font-bold px-2 py-1 rounded transition"
                    >
                      50/50 Split (₹{(netDueForCurrentBill / 2).toFixed(2)})
                    </button>
                    {cashVal > 0 && cashVal < netDueForCurrentBill && (
                      <button
                        type="button"
                        onClick={() => setUpiPaid(Math.max(0, netDueForCurrentBill - cashVal))}
                        className="text-[10px] bg-white border border-purple-300 text-purple-700 hover:bg-purple-100 font-bold px-2 py-1 rounded transition"
                      >
                        Fill Remaining in UPI (₹{Math.max(0, netDueForCurrentBill - cashVal).toFixed(2)})
                      </button>
                    )}
                    {upiVal > 0 && upiVal < netDueForCurrentBill && (
                      <button
                        type="button"
                        onClick={() => setCashPaid(Math.max(0, netDueForCurrentBill - upiVal))}
                        className="text-[10px] bg-white border border-purple-300 text-purple-700 hover:bg-purple-100 font-bold px-2 py-1 rounded transition"
                      >
                        Fill Remaining in Cash (₹{Math.max(0, netDueForCurrentBill - upiVal).toFixed(2)})
                      </button>
                    )}
                  </div>
                </div>
              )}

              {paymentMode === 'Pay Later' && (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs space-y-2">
                  <div className="flex justify-between items-center text-amber-900 font-bold">
                    <span>Credit / Pay Later:</span>
                    <span className="text-base font-extrabold font-mono">
                      ₹{Math.max(0, roundedTotal - (useAdvance ? Number(advanceUsed || 0) : 0)).toFixed(2)}
                    </span>
                  </div>
                  {useAdvance && Number(advanceUsed || 0) > 0 ? (
                    <div className="text-[11px] text-amber-800 space-y-0.5">
                      <div className="flex justify-between text-teal-900 font-medium bg-teal-100/70 px-2 py-1 rounded">
                        <span>Paid from Advance:</span>
                        <span className="font-bold font-mono">₹{Number(advanceUsed || 0).toFixed(2)}</span>
                      </div>
                      <p className="pt-1">
                        Remaining balance of <strong>₹{Math.max(0, roundedTotal - Number(advanceUsed || 0)).toFixed(2)}</strong> will be tracked as Pay Later due on the customer&apos;s ledger.
                      </p>
                    </div>
                  ) : (
                    <p className="text-[11px] text-amber-800">
                      No payment collected upfront. The full amount of <strong>₹{roundedTotal.toFixed(2)}</strong> will be tracked on the customer&apos;s ledger.
                    </p>
                  )}
                  {!selectedCustomerId && (
                    <div className="bg-rose-100 text-rose-800 p-2 rounded text-[11px] font-bold border border-rose-200">
                      ⚠️ Customer is required for Pay Later. Please select or add a customer above.
                    </div>
                  )}
                </div>
              )}

              {paymentMode === 'Advance' && (
                <div className="p-3 bg-teal-50 border border-teal-200 rounded-lg text-xs space-y-2">
                  <div className="flex justify-between items-center text-teal-900 font-bold">
                    <span>Deduct from Advance:</span>
                    <span className="text-base font-extrabold font-mono">
                      ₹{Math.min(selectedCustomer?.advance_balance || 0, roundedTotal).toFixed(2)}
                    </span>
                  </div>
                  <div className="flex justify-between text-[11px] text-teal-800 font-medium">
                    <span>Available Advance:</span>
                    <span className="font-mono font-bold">₹{(selectedCustomer?.advance_balance || 0).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-[11px] text-teal-800 font-medium">
                    <span>Remaining Advance after Bill:</span>
                    <span className="font-mono font-bold">
                      ₹{Math.max(0, (selectedCustomer?.advance_balance || 0) - roundedTotal).toFixed(2)}
                    </span>
                  </div>
                  {roundedTotal > (selectedCustomer?.advance_balance || 0) && (
                    <div className="text-[10px] bg-amber-100 text-amber-900 p-2 rounded font-semibold">
                      Advance covers ₹{(selectedCustomer?.advance_balance || 0).toFixed(2)}. Remaining ₹{(roundedTotal - (selectedCustomer?.advance_balance || 0)).toFixed(2)} will be due on ledger, or switch to <strong>Split</strong> to pay the remainder with Cash/UPI.
                    </div>
                  )}
                </div>
              )}

              {/* Payment Math Feedback */}
              <div className="flex flex-col space-y-1 text-xs pt-1 font-semibold border-t border-slate-100 mt-1">
                <div className="flex justify-between items-center">
                  <span className="text-slate-600">Paid Now: <strong className="text-slate-900 font-data-mono">₹{totalPaidNow.toFixed(2)}</strong></span>
                  {remainingBillBalance > 0 ? (
                    <span className="text-rose-600 font-bold">Current Bill Due: ₹{remainingBillBalance.toFixed(2)}</span>
                  ) : (
                    <span className="text-emerald-600 font-bold">Bill Paid Full ✓</span>
                  )}
                </div>
                {allocatedToPriorBalance > 0 && (
                  <div className="flex justify-between items-center text-[11px] text-amber-700 font-bold">
                    <span>Allocated to Prev. Due:</span>
                    <span className="font-data-mono">₹{allocatedToPriorBalance.toFixed(2)}</span>
                  </div>
                )}
                {customerAdvanceEarned > 0 && (
                  <div className="flex justify-between items-center text-[11px] text-blue-700 font-bold">
                    <span>Saved to Advance:</span>
                    <span className="font-data-mono">₹{customerAdvanceEarned.toFixed(2)}</span>
                  </div>
                )}
              </div>
            </div>

            {/* ACTION BUTTON */}
            <div className="pt-2">
              <button
                onClick={handleCreateBill}
                disabled={saving || cart.length === 0}
                className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-sm py-3 rounded-lg shadow-md transition flex items-center justify-center space-x-2 disabled:opacity-50"
              >
                <Receipt size={18} />
                <span>{saving ? 'Generating Bill...' : 'Generate Bill & Receipt'}</span>
              </button>
            </div>
            </div>
            </div>
          )}

          {/* SPLIT BILLING RIGHT COLUMN */}
          {billingMode === 'SPLIT' && (
            <div className="space-y-4">
              <div className="bg-amber-50/60 p-4 rounded-xl border border-amber-200 text-xs space-y-3">
                <div className="flex justify-between items-center border-b border-amber-200 pb-2">
                  <span className="font-bold text-amber-950 flex items-center gap-1.5">
                    <Split size={14} className="text-amber-700" />
                    <span>Split Billing Summary</span>
                  </span>
                  <span className="font-mono font-bold text-amber-900 bg-amber-100 px-2 py-0.5 rounded">
                    {splitSelectedCustomerIds.length} Customers
                  </span>
                </div>

                <div className="flex justify-between items-center text-slate-700">
                  <span>Cart Total per Customer:</span>
                  <span className="font-mono font-bold text-slate-900 text-sm">₹{roundedTotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between items-center text-slate-700">
                  <span>Combined Group Total:</span>
                  <span className="font-mono font-extrabold text-amber-900 text-base">
                    ₹{(roundedTotal * splitSelectedCustomerIds.length).toFixed(2)}
                  </span>
                </div>
              </div>

              {/* Per-Customer Breakdown Cards */}
              {splitSelectedCustomerIds.length === 0 ? (
                <div className="py-8 text-center bg-slate-50 rounded-xl border border-dashed border-slate-200 text-xs text-slate-500">
                  Please select one or more customers on the left to configure their payment settlement.
                </div>
              ) : (
                <div className="space-y-2.5 max-h-72 overflow-y-auto pr-1">
                  {splitSelectedCustomerIds.map((cid, idx) => {
                    const cust = customers.find(c => c.id === cid);
                    if (!cust) return null;
                    const ov = splitOverrides[cid] || { use_advance: true, cash_paid: '', upi_paid: '', payment_method: 'Pay Later' };
                    const custAdv = Number(cust.advance_balance || 0);
                    const advUsed = ov.use_advance ? Math.min(custAdv, roundedTotal) : 0;
                    const directPaid = Number(ov.cash_paid || 0) + Number(ov.upi_paid || 0);
                    const netDue = Math.max(0, roundedTotal - advUsed - directPaid);

                    return (
                      <div key={cid} className="p-3 bg-white rounded-xl border border-amber-200/80 shadow-2xs text-xs space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-slate-900 flex items-center gap-1.5">
                            <span className="w-5 h-5 rounded-full bg-amber-100 text-amber-800 text-[10px] flex items-center justify-center font-bold">
                              {idx + 1}
                            </span>
                            <span>{cust.name}</span>
                          </span>
                          <span className="font-mono font-bold text-slate-900">₹{roundedTotal.toFixed(2)}</span>
                        </div>

                        {/* Advance balance usage & payment override */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 border-t border-slate-100 text-[11px]">
                          <div>
                            {custAdv > 0 ? (
                              <label className="flex items-center gap-1.5 cursor-pointer text-teal-800 font-semibold">
                                <input
                                  type="checkbox"
                                  checked={ov.use_advance}
                                  onChange={(e) => handleUpdateSplitOverride(cid, 'use_advance', e.target.checked)}
                                  className="rounded text-teal-600 focus:ring-teal-500 cursor-pointer"
                                />
                                <span>Use Adv: ₹{advUsed.toFixed(2)}</span>
                                <span className="text-[10px] text-teal-600">(Avail: ₹{custAdv.toFixed(0)})</span>
                              </label>
                            ) : (
                              <span className="text-slate-400 text-[10px]">No advance balance</span>
                            )}
                          </div>

                          <div className="flex items-center justify-end gap-1.5">
                            <span className="text-slate-500 text-[10px]">Due to Pay Later:</span>
                            <span className={`font-mono font-bold ${netDue > 0 ? 'text-amber-800' : 'text-emerald-700'}`}>
                              ₹{netDue.toFixed(2)}
                            </span>
                          </div>
                        </div>

                        {/* Optional Direct Cash / UPI override */}
                        <div className="flex items-center justify-between gap-2 pt-1 border-t border-dashed border-slate-100 text-[10px] text-slate-500">
                          <span>Pay Now (Optional):</span>
                          <div className="flex items-center gap-2">
                            <input
                              type="number"
                              min="0"
                              placeholder="Cash ₹"
                              value={ov.cash_paid}
                              onChange={(e) => handleUpdateSplitOverride(cid, 'cash_paid', e.target.value === '' ? '' : Math.max(0, Number(e.target.value)))}
                              className="w-16 bg-slate-50 border border-slate-200 rounded px-1.5 py-0.5 text-right font-bold text-slate-800"
                            />
                            <input
                              type="number"
                              min="0"
                              placeholder="UPI ₹"
                              value={ov.upi_paid}
                              onChange={(e) => handleUpdateSplitOverride(cid, 'upi_paid', e.target.value === '' ? '' : Math.max(0, Number(e.target.value)))}
                              className="w-16 bg-slate-50 border border-slate-200 rounded px-1.5 py-0.5 text-right font-bold text-slate-800"
                            />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Group Order Remarks */}
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">Group Order Remarks (Optional)</label>
                <input
                  type="text"
                  placeholder="e.g. Class project printouts / Exam notes"
                  value={groupNotes}
                  onChange={(e) => setGroupNotes(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-xs text-slate-800 focus:ring-1 focus:ring-amber-500"
                />
              </div>

              {/* Submit Split Group Bill */}
              <button
                type="button"
                onClick={handleCreateSplitBillingSubmit}
                disabled={saving || cart.length === 0 || splitSelectedCustomerIds.length === 0}
                className="w-full bg-amber-600 hover:bg-amber-500 text-white font-extrabold text-sm py-3 rounded-lg shadow-md transition flex items-center justify-center space-x-2 disabled:opacity-50 cursor-pointer"
              >
                <Split size={18} />
                <span>
                  {saving 
                    ? 'Generating Split Bills...' 
                    : `Generate Split Group Bill (${splitSelectedCustomerIds.length} Customers • ₹${(roundedTotal * splitSelectedCustomerIds.length).toFixed(2)})`}
                </span>
              </button>
            </div>
          )}

          {/* SHARED BILLING RIGHT COLUMN */}
          {billingMode === 'SHARED' && (
            <div className="space-y-4">
              <div className="bg-emerald-50/60 p-4 rounded-xl border border-emerald-200 text-xs space-y-3">
                <div className="flex justify-between items-center border-b border-emerald-200 pb-2">
                  <span className="font-bold text-emerald-950 flex items-center gap-1.5">
                    <Users size={14} className="text-emerald-700" />
                    <span>Shared Order Grand Total</span>
                  </span>
                  <span className="font-mono font-extrabold text-emerald-900 text-base">
                    ₹{roundedTotal.toFixed(2)}
                  </span>
                </div>

                {/* Allocation Balance Indicator */}
                {(() => {
                  const sumShares = Number(sharedParticipants.reduce((s, p) => s + Number(p.share_amount || 0), 0).toFixed(2));
                  const diff = Number((roundedTotal - sumShares).toFixed(2));
                  const isBalanced = Math.abs(diff) <= 0.05;

                  return (
                    <div className="flex items-center justify-between text-xs pt-1">
                      <span className="text-slate-600">
                        Total Allocated: <strong className="font-mono text-slate-900">₹{sumShares.toFixed(2)}</strong>
                      </span>
                      {isBalanced ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">
                          <Check size={12} />
                          <span>Exact Match ✓</span>
                        </span>
                      ) : (
                        <div className="flex items-center gap-2">
                          <span className="text-[11px] font-bold text-rose-700 bg-rose-100 px-2 py-0.5 rounded-full">
                            Difference: {diff > 0 ? `+₹${diff.toFixed(2)} Unassigned` : `-₹${Math.abs(diff).toFixed(2)} Excess`}
                          </span>
                          <button
                            type="button"
                            onClick={() => autoRecalculateEqualSplit(sharedParticipants)}
                            className="text-[11px] text-emerald-700 font-bold underline cursor-pointer"
                          >
                            Divide Equally
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })()}

                <p className="text-[11px] text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-2.5 py-1.5">
                  Total is divided equally (Total / N). Collect payments per member or combined after generating the bill.
                </p>
              </div>

              {/* Shared Participants Overview */}
              {sharedParticipants.length === 0 ? (
                <div className="py-8 text-center bg-slate-50 rounded-xl border border-dashed border-slate-200 text-xs text-slate-500">
                  Please add group participants on the left to review equal shares.
                </div>
              ) : (
                <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                  {sharedParticipants.map((part, idx) => {
                    const cust = part.customer_id ? customers.find(c => c.id === part.customer_id) : null;
                    const isRegistered = Boolean(part.customer_id);
                    const name = isRegistered ? cust?.name : `${part.guest_name} (Guest)`;

                    return (
                      <div key={part.id} className="p-3 bg-white rounded-xl border border-emerald-200/80 shadow-2xs text-xs flex items-center justify-between">
                        <span className="font-bold text-slate-900 flex items-center gap-1.5">
                          <span className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] flex items-center justify-center font-bold">
                            {idx + 1}
                          </span>
                          <span>{name}</span>
                        </span>
                        <span className="font-mono font-extrabold text-slate-900 text-sm">
                          ₹{Number(part.share_amount || 0).toFixed(2)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Group Order Remarks */}
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">Group Order Remarks (Optional)</label>
                <input
                  type="text"
                  placeholder="e.g. Group photocopy batch of 4 members"
                  value={groupNotes}
                  onChange={(e) => setGroupNotes(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-xs text-slate-800 focus:ring-1 focus:ring-emerald-500"
                />
              </div>

              {/* Submit Shared Group Bill */}
              <button
                type="button"
                onClick={handleCreateSharedBillingSubmit}
                disabled={
                  saving || 
                  cart.length === 0 || 
                  sharedParticipants.length === 0 || 
                  Math.abs(Number(sharedParticipants.reduce((s, p) => s + Number(p.share_amount || 0), 0).toFixed(2)) - roundedTotal) > 0.05
                }
                className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-sm py-3 rounded-lg shadow-md transition flex items-center justify-center space-x-2 disabled:opacity-50 cursor-pointer"
              >
                <Users size={18} />
                <span>
                  {saving 
                    ? 'Generating Shared Bill...' 
                    : `Generate Shared Group Bill (${sharedParticipants.length} Members • ₹${roundedTotal.toFixed(2)})`}
                </span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* QUICK ADD CUSTOMER MODAL */}
      {showAddCustomerModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-sm w-full p-5 space-y-4">
            <h3 className="font-bold text-slate-900 text-base">Quick Add New Customer</h3>
            <form onSubmit={handleAddCustomerSubmit} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Customer Name *</label>
                <input
                  type="text"
                  required
                  value={newCustName}
                  onChange={(e) => setNewCustName(e.target.value)}
                  className={`w-full bg-slate-50 border rounded px-3 py-1.5 text-xs font-medium ${
                    exactDuplicateNewCust ? 'border-rose-400 bg-rose-50/40' : 'border-slate-300'
                  }`}
                />
                {exactDuplicateNewCust && (
                  <div className="mt-1.5 bg-rose-50 border border-rose-200 rounded p-2 text-xs text-rose-800 space-y-1.5">
                    <p className="font-bold flex items-center space-x-1">
                      <AlertTriangle size={13} className="text-rose-600 shrink-0" />
                      <span>Customer &ldquo;{exactDuplicateNewCust.name}&rdquo; already exists!</span>
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedCustomerId(exactDuplicateNewCust.id);
                        setShowAddCustomerModal(false);
                        setNewCustName('');
                        setNewCustMobile('');
                        setNewCustEmail('');
                      }}
                      className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-1 px-2.5 rounded text-[11px]"
                    >
                      Select Existing &ldquo;{exactDuplicateNewCust.name}&rdquo;
                    </button>
                  </div>
                )}
                {!exactDuplicateNewCust && similarNewCustomers.length > 0 && (
                  <div className="mt-1.5 bg-slate-50 border border-slate-200 rounded p-2 space-y-1">
                    <p className="text-[10px] font-bold uppercase text-slate-500">Matching Existing Customers:</p>
                    {similarNewCustomers.map(match => (
                      <div key={match.id} className="flex items-center justify-between text-xs py-0.5">
                        <span className="font-semibold text-slate-800 truncate">
                          {match.name} {match.mobile ? `(${match.mobile})` : ''}
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedCustomerId(match.id);
                            setShowAddCustomerModal(false);
                            setNewCustName('');
                            setNewCustMobile('');
                            setNewCustEmail('');
                          }}
                          className="text-blue-600 hover:underline font-bold text-[11px] ml-2 shrink-0"
                        >
                          Use
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Mobile Number (Optional)</label>
                <input
                  type="text"
                  placeholder="e.g. 9876543210"
                  value={newCustMobile}
                  onChange={(e) => setNewCustMobile(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded px-3 py-1.5 text-xs font-medium"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Email Address (Optional)</label>
                <input
                  type="email"
                  placeholder="customer@example.com"
                  value={newCustEmail}
                  onChange={(e) => setNewCustEmail(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded px-3 py-1.5 text-xs font-medium"
                />
              </div>

              <div className="flex justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddCustomerModal(false)}
                  className="px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={Boolean(exactDuplicateNewCust)}
                  className="px-4 py-1.5 text-xs font-bold bg-blue-600 hover:bg-blue-500 text-white rounded shadow disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Save & Select
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* INVOICE MODAL */}
      {savedBill && (
        <InvoiceModal 
          bill={savedBill} 
          settings={settings || undefined} 
          customerEmail={customers.find(c => c.id === savedBill.customer_id)?.email || savedBill.customer_email || undefined} 
          onClose={() => setSavedBill(null)} 
        />
      )}

      {/* GROUP INVOICE MODAL */}
      {savedGroupBill && (
        <GroupInvoiceModal
          groupBill={savedGroupBill}
          settings={settings || undefined}
          onClose={() => setSavedGroupBill(null)}
          onCancelMemberBill={async () => {
            // Refresh group bill data
            if (savedGroupBill?.id) {
              const updated = await ApiService.getGroupBillById(savedGroupBill.id);
              if (updated) setSavedGroupBill(updated);
            }
          }}
        />
      )}
    </div>
  );
}
