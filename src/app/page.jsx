'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  EXPENSE_CATEGORIES,
  INCOME_CATEGORIES,
  ACCOUNT_TYPE_META,
  loadAppState,
  saveAppState,
  loadCurrentUser,
  saveCurrentUser,
  createInitialSeedData,
  isSupabaseConfigured,
  startSupabaseGoogleLogin,
} from '../lib/supabase';

function formatTHB(amount) {
  const num = Number(amount) || 0;
  return new Intl.NumberFormat('th-TH', {
    style: 'currency',
    currency: 'THB',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(num);
}

export default function MoneyAppPage() {
  const [hydrated, setHydrated] = useState(false);
  const [appState, setAppState] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);

  // Navigation & View Mode
  const [activeTab, setActiveTab] = useState('dashboard'); // dashboard | accounts | loans | reports | family
  const [viewMode, setViewMode] = useState('personal'); // personal | family

  // Login Form State
  const [customGmail, setCustomGmail] = useState('');
  const [customName, setCustomName] = useState('');
  const [loginError, setLoginError] = useState('');

  // Modals State
  const [showTxModal, setShowTxModal] = useState(false);
  const [showAccountModal, setShowAccountModal] = useState(false);
  const [showPayCardModal, setShowPayCardModal] = useState(null); // account object
  const [showInstallmentModal, setShowInstallmentModal] = useState(false);
  const [showLoanModal, setShowLoanModal] = useState(false);
  const [showRepayLoanModal, setShowRepayLoanModal] = useState(null); // loan object
  const [toastMessage, setToastMessage] = useState('');

  // Transaction Form State
  const [txType, setTxType] = useState('expense'); // expense | income | transfer
  const [txAmount, setTxAmount] = useState('');
  const [txCategory, setTxCategory] = useState('food');
  const [txAccountId, setTxAccountId] = useState('');
  const [txToAccountId, setTxToAccountId] = useState('');
  const [txNote, setTxNote] = useState('');
  const [txDate, setTxDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [txIsInstallment, setTxIsInstallment] = useState(false);
  const [txInstallmentMonths, setTxInstallmentMonths] = useState('6');
  const [txShared, setTxShared] = useState(false);

  // New Account / Card Form State
  const [accName, setAccName] = useState('');
  const [accType, setAccType] = useState('bank');
  const [accBalance, setAccBalance] = useState('');
  const [accCreditLimit, setAccCreditLimit] = useState('50000');
  const [accUsedAmount, setAccUsedAmount] = useState('0');
  const [accStatementDay, setAccStatementDay] = useState('25');
  const [accDueDay, setAccDueDay] = useState('10');
  const [accColor, setAccColor] = useState('#4f46e5');
  const [accShared, setAccShared] = useState(false);

  // Pay Credit Card Modal State
  const [payCardFromAccId, setPayCardFromAccId] = useState('');
  const [payCardAmount, setPayCardAmount] = useState('');

  // New Installment Form State
  const [instTitle, setInstTitle] = useState('');
  const [instAccountId, setInstAccountId] = useState('');
  const [instTotalAmount, setInstTotalAmount] = useState('');
  const [instMonths, setInstMonths] = useState('10');
  const [instShared, setInstShared] = useState(false);

  // New Loan Form State
  const [loanType, setLoanType] = useState('lend'); // lend | borrow
  const [loanPerson, setLoanPerson] = useState('');
  const [loanAmount, setLoanAmount] = useState('');
  const [loanAccountId, setLoanAccountId] = useState('');
  const [loanDueDate, setLoanDueDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [loanNote, setLoanNote] = useState('');
  const [loanShared, setLoanShared] = useState(true);

  // Repay Loan Form State
  const [repayAmount, setRepayAmount] = useState('');
  const [repayAccountId, setRepayAccountId] = useState('');
  const [repayNote, setRepayNote] = useState('');

  // Family Form State
  const [inviteEmailInput, setInviteEmailInput] = useState('');
  const [joinCodeInput, setJoinCodeInput] = useState('');
  const [newFamilyName, setNewFamilyName] = useState('');

  useEffect(() => {
    const loadedState = loadAppState();
    const loadedUser = loadCurrentUser();
    setAppState(loadedState);
    setCurrentUser(loadedUser);
    setHydrated(true);
  }, []);

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage((prev) => (prev === msg ? '' : prev));
    }, 3200);
  };

  const updateState = (updater) => {
    setAppState((prev) => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      saveAppState(next);
      return next;
    });
  };

  // Current user's family group
  const currentFamily = useMemo(() => {
    if (!appState || !currentUser) return null;
    return (
      appState.familyGroups.find(
        (fg) =>
          fg.id === currentUser.familyId ||
          fg.memberEmails.includes(currentUser.email)
      ) || null
    );
  }, [appState, currentUser]);

  // Filtered data based on View Mode (Personal vs Family Shared)
  const visibleAccounts = useMemo(() => {
    if (!appState || !currentUser) return [];
    if (viewMode === 'family' && currentFamily) {
      return appState.accounts.filter(
        (a) =>
          currentFamily.memberEmails.includes(a.ownerEmail) &&
          (a.isSharedWithFamily || a.ownerEmail === currentUser.email)
      );
    }
    return appState.accounts.filter((a) => a.ownerEmail === currentUser.email);
  }, [appState, currentUser, viewMode, currentFamily]);

  const visibleInstallments = useMemo(() => {
    if (!appState || !currentUser) return [];
    if (viewMode === 'family' && currentFamily) {
      return appState.installments.filter(
        (inst) =>
          currentFamily.memberEmails.includes(inst.ownerEmail) &&
          (inst.isSharedWithFamily || inst.ownerEmail === currentUser.email)
      );
    }
    return appState.installments.filter((i) => i.ownerEmail === currentUser.email);
  }, [appState, currentUser, viewMode, currentFamily]);

  const visibleTransactions = useMemo(() => {
    if (!appState || !currentUser) return [];
    if (viewMode === 'family' && currentFamily) {
      return appState.transactions.filter(
        (t) =>
          currentFamily.memberEmails.includes(t.ownerEmail) &&
          (t.isSharedWithFamily || t.ownerEmail === currentUser.email)
      );
    }
    return appState.transactions.filter((t) => t.ownerEmail === currentUser.email);
  }, [appState, currentUser, viewMode, currentFamily]);

  const visibleLoans = useMemo(() => {
    if (!appState || !currentUser) return [];
    if (viewMode === 'family' && currentFamily) {
      return appState.loans.filter(
        (l) =>
          currentFamily.memberEmails.includes(l.ownerEmail) &&
          (l.isSharedWithFamily || l.ownerEmail === currentUser.email)
      );
    }
    return appState.loans.filter((l) => l.ownerEmail === currentUser.email);
  }, [appState, currentUser, viewMode, currentFamily]);

  // Separate Asset Accounts vs Credit Card / BNPL Accounts
  const assetAccounts = useMemo(
    () => visibleAccounts.filter((a) => !ACCOUNT_TYPE_META[a.type]?.isLiability),
    [visibleAccounts]
  );
  const creditAccounts = useMemo(
    () => visibleAccounts.filter((a) => ACCOUNT_TYPE_META[a.type]?.isLiability),
    [visibleAccounts]
  );

  // Financial Summary Totals
  const summary = useMemo(() => {
    const totalAssets = assetAccounts.reduce((sum, a) => sum + Number(a.balance || 0), 0);
    const totalCreditUsed = creditAccounts.reduce((sum, a) => sum + Number(a.usedAmount || 0), 0);
    const totalCreditLimit = creditAccounts.reduce((sum, a) => sum + Number(a.creditLimit || 0), 0);

    const totalReceivableLoans = visibleLoans
      .filter((l) => l.loanType === 'lend' && l.status === 'active')
      .reduce((sum, l) => sum + Math.max(0, Number(l.totalAmount) - Number(l.paidAmount)), 0);

    const totalPayableLoans = visibleLoans
      .filter((l) => l.loanType === 'borrow' && l.status === 'active')
      .reduce((sum, l) => sum + Math.max(0, Number(l.totalAmount) - Number(l.paidAmount)), 0);

    const totalIncome = visibleTransactions
      .filter((t) => t.type === 'income')
      .reduce((sum, t) => sum + Number(t.amount || 0), 0);

    const totalExpense = visibleTransactions
      .filter((t) => t.type === 'expense')
      .reduce((sum, t) => sum + Number(t.amount || 0), 0);

    const netWorth = totalAssets + totalReceivableLoans - totalCreditUsed - totalPayableLoans;

    return {
      totalAssets,
      totalCreditUsed,
      totalCreditLimit,
      totalReceivableLoans,
      totalPayableLoans,
      totalIncome,
      totalExpense,
      netWorth,
    };
  }, [assetAccounts, creditAccounts, visibleLoans, visibleTransactions]);

  // Handle Google Login (Preset or Custom Gmail)
  const handleLoginWithGmail = (email, name) => {
    const cleanEmail = (email || '').trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes('@')) {
      setLoginError('กรุณากรอกอีเมล Gmail ให้ถูกต้อง เช่น name@gmail.com');
      return;
    }
    setLoginError('');

    const existingUser = appState.users.find((u) => u.email.toLowerCase() === cleanEmail);
    if (existingUser) {
      setCurrentUser(existingUser);
      saveCurrentUser(existingUser);
      showToast(`เข้าสู่ระบบด้วย ${existingUser.email} สำเร็จ`);
      return;
    }

    const displayName = (name || cleanEmail.split('@')[0]).trim();
    const defaultFamily = appState.familyGroups[0];
    const newUser = {
      email: cleanEmail,
      name: displayName,
      avatar: displayName.slice(0, 1).toUpperCase(),
      familyId: defaultFamily ? defaultFamily.id : null,
    };

    const today = new Date().toISOString().slice(0, 10);
    const starterCashAcc = {
      id: `acc-${Date.now()}`,
      ownerEmail: cleanEmail,
      ownerName: displayName,
      familyId: newUser.familyId,
      isSharedWithFamily: true,
      name: `กระเป๋าเงินสด (${displayName})`,
      type: 'cash',
      balance: 5000,
      creditLimit: 0,
      usedAmount: 0,
      statementDay: 1,
      dueDay: 1,
      color: '#059669',
      createdAt: today,
    };

    updateState((prev) => ({
      ...prev,
      users: [...prev.users, newUser],
      familyGroups: prev.familyGroups.map((fg, idx) =>
        idx === 0 && !fg.memberEmails.includes(cleanEmail)
          ? { ...fg, memberEmails: [...fg.memberEmails, cleanEmail] }
          : fg
      ),
      accounts: [...prev.accounts, starterCashAcc],
    }));

    setCurrentUser(newUser);
    saveCurrentUser(newUser);
    showToast(`ยินดีต้อนรับ ${displayName} (${cleanEmail})`);
  };

  const handleLogout = () => {
    setCurrentUser(null);
    saveCurrentUser(null);
  };

  // Open Transaction Modal with sensible default account
  const openNewTransactionModal = (defaultType = 'expense') => {
    setTxType(defaultType);
    setTxAmount('');
    setTxNote('');
    setTxIsInstallment(false);
    setTxCategory(defaultType === 'income' ? 'salary' : 'food');
    const myAccs = appState.accounts.filter((a) => a.ownerEmail === currentUser.email);
    const firstAcc = myAccs[0] || visibleAccounts[0];
    if (firstAcc) {
      setTxAccountId(firstAcc.id);
      setTxShared(Boolean(firstAcc.isSharedWithFamily));
    }
    const secondAcc = myAccs[1] || visibleAccounts[1];
    if (secondAcc) {
      setTxToAccountId(secondAcc.id);
    }
    setShowTxModal(true);
  };

  // Submit Transaction (Income / Expense / Transfer / Installment Swipe)
  const handleAddTransaction = (e) => {
    e.preventDefault();
    const amount = parseFloat(txAmount);
    if (!amount || amount <= 0 || !txAccountId) return;

    const selectedAcc = appState.accounts.find((a) => a.id === txAccountId);
    if (!selectedAcc) return;

    const isCreditOrBnpl = ACCOUNT_TYPE_META[selectedAcc.type]?.isLiability;
    const today = txDate || new Date().toISOString().slice(0, 10);

    updateState((prev) => {
      const updatedAccounts = prev.accounts.map((acc) => {
        if (txType === 'income' && acc.id === txAccountId) {
          if (ACCOUNT_TYPE_META[acc.type]?.isLiability) {
            return { ...acc, usedAmount: Math.max(0, Number(acc.usedAmount) - amount) };
          }
          return { ...acc, balance: Number(acc.balance) + amount };
        }
        if (txType === 'expense' && acc.id === txAccountId) {
          if (ACCOUNT_TYPE_META[acc.type]?.isLiability) {
            return { ...acc, usedAmount: Number(acc.usedAmount) + amount };
          }
          return { ...acc, balance: Number(acc.balance) - amount };
        }
        if (txType === 'transfer') {
          if (acc.id === txAccountId) {
            return { ...acc, balance: Number(acc.balance) - amount };
          }
          if (acc.id === txToAccountId) {
            if (ACCOUNT_TYPE_META[acc.type]?.isLiability) {
              return { ...acc, usedAmount: Math.max(0, Number(acc.usedAmount) - amount) };
            }
            return { ...acc, balance: Number(acc.balance) + amount };
          }
        }
        return acc;
      });

      const newTx = {
        id: `tx-${Date.now()}`,
        ownerEmail: currentUser.email,
        ownerName: currentUser.name,
        isSharedWithFamily: txShared,
        type:
          txType === 'transfer' &&
          prev.accounts.find((a) => a.id === txToAccountId && ACCOUNT_TYPE_META[a.type]?.isLiability)
            ? 'card_payment'
            : txType,
        amount,
        category: txType === 'transfer' ? 'transfer' : txCategory,
        note:
          txNote.trim() ||
          (txType === 'income'
            ? 'บันทึกรายรับ'
            : txType === 'transfer'
            ? 'โอนเงินระหว่างบัญชี'
            : 'บันทึกรายจ่าย'),
        accountId: txAccountId,
        toAccountId: txType === 'transfer' ? txToAccountId : undefined,
        txDate: today,
        createdAt: today,
      };

      let updatedInstallments = prev.installments;
      if (txType === 'expense' && isCreditOrBnpl && txIsInstallment) {
        const months = Math.max(2, parseInt(txInstallmentMonths, 10) || 6);
        const newInst = {
          id: `inst-${Date.now()}`,
          accountId: txAccountId,
          ownerEmail: currentUser.email,
          ownerName: currentUser.name,
          isSharedWithFamily: txShared,
          title: `${newTx.note} (ผ่อน ${months} เดือน)`,
          totalAmount: amount,
          totalMonths: months,
          paidMonths: 0,
          monthlyAmount: Math.round((amount / months) * 100) / 100,
          interestRate: 0,
          startDate: today,
          createdAt: today,
        };
        updatedInstallments = [newInst, ...prev.installments];
      }

      return {
        ...prev,
        accounts: updatedAccounts,
        installments: updatedInstallments,
        transactions: [newTx, ...prev.transactions],
      };
    });

    setShowTxModal(false);
    showToast('บันทึกรายการเรียบร้อยแล้ว');
  };

  // Add New Account or Credit Card / BNPL
  const handleCreateAccount = (e) => {
    e.preventDefault();
    if (!accName.trim()) return;
    const isLiability = ACCOUNT_TYPE_META[accType]?.isLiability;
    const today = new Date().toISOString().slice(0, 10);

    const newAcc = {
      id: `acc-${Date.now()}`,
      ownerEmail: currentUser.email,
      ownerName: currentUser.name,
      familyId: currentFamily?.id || null,
      isSharedWithFamily: accShared,
      name: accName.trim(),
      type: accType,
      balance: isLiability ? 0 : parseFloat(accBalance) || 0,
      creditLimit: isLiability ? parseFloat(accCreditLimit) || 50000 : 0,
      usedAmount: isLiability ? parseFloat(accUsedAmount) || 0 : 0,
      statementDay: parseInt(accStatementDay, 10) || 25,
      dueDay: parseInt(accDueDay, 10) || 10,
      color: accColor,
      createdAt: today,
    };

    updateState((prev) => ({
      ...prev,
      accounts: [...prev.accounts, newAcc],
    }));

    setAccName('');
    setAccBalance('');
    setShowAccountModal(false);
    showToast(`สร้าง "${newAcc.name}" เรียบร้อยแล้ว`);
  };

  // Pay Credit Card / BNPL Bill
  const handlePayCreditCardBill = (e) => {
    e.preventDefault();
    if (!showPayCardModal || !payCardFromAccId) return;
    const amount = parseFloat(payCardAmount);
    if (!amount || amount <= 0) return;

    const cardAcc = showPayCardModal;
    const bankAcc = appState.accounts.find((a) => a.id === payCardFromAccId);
    if (!bankAcc) return;

    const today = new Date().toISOString().slice(0, 10);

    updateState((prev) => ({
      ...prev,
      accounts: prev.accounts.map((a) => {
        if (a.id === bankAcc.id) {
          return { ...a, balance: Number(a.balance) - amount };
        }
        if (a.id === cardAcc.id) {
          return { ...a, usedAmount: Math.max(0, Number(a.usedAmount) - amount) };
        }
        return a;
      }),
      transactions: [
        {
          id: `tx-${Date.now()}`,
          ownerEmail: currentUser.email,
          ownerName: currentUser.name,
          isSharedWithFamily: Boolean(cardAcc.isSharedWithFamily),
          type: 'card_payment',
          amount,
          category: 'transfer',
          note: `จ่ายบิล ${cardAcc.name} (ตัดจาก ${bankAcc.name})`,
          accountId: bankAcc.id,
          toAccountId: cardAcc.id,
          txDate: today,
          createdAt: today,
        },
        ...prev.transactions,
      ],
    }));

    setShowPayCardModal(null);
    showToast(`จ่ายบิล ${cardAcc.name} จำนวน ${formatTHB(amount)} สำเร็จ!`);
  };

  // Add Standalone Installment Plan
  const handleCreateInstallment = (e) => {
    e.preventDefault();
    const total = parseFloat(instTotalAmount);
    const months = parseInt(instMonths, 10) || 10;
    if (!instTitle.trim() || !total || total <= 0 || !instAccountId) return;

    const today = new Date().toISOString().slice(0, 10);
    const monthly = Math.round((total / months) * 100) / 100;

    updateState((prev) => ({
      ...prev,
      accounts: prev.accounts.map((a) =>
        a.id === instAccountId ? { ...a, usedAmount: Number(a.usedAmount) + total } : a
      ),
      installments: [
        {
          id: `inst-${Date.now()}`,
          accountId: instAccountId,
          ownerEmail: currentUser.email,
          ownerName: currentUser.name,
          isSharedWithFamily: instShared,
          title: instTitle.trim(),
          totalAmount: total,
          totalMonths: months,
          paidMonths: 0,
          monthlyAmount: monthly,
          interestRate: 0,
          startDate: today,
          createdAt: today,
        },
        ...prev.installments,
      ],
    }));

    setInstTitle('');
    setInstTotalAmount('');
    setShowInstallmentModal(false);
    showToast('เพิ่มแผนผ่อนชำระเรียบร้อยแล้ว');
  };

  // Pay 1 Installment Month
  const handleAdvanceInstallmentMonth = (inst) => {
    if (inst.paidMonths >= inst.totalMonths) return;
    updateState((prev) => ({
      ...prev,
      installments: prev.installments.map((item) =>
        item.id === inst.id ? { ...item, paidMonths: item.paidMonths + 1 } : item
      ),
    }));
    showToast(`บันทึกจ่ายงวดที่ ${inst.paidMonths + 1}/${inst.totalMonths} ของ "${inst.title}" แล้ว`);
  };

  // Create Loan (Lend or Borrow)
  const handleCreateLoan = (e) => {
    e.preventDefault();
    const amount = parseFloat(loanAmount);
    if (!loanPerson.trim() || !amount || amount <= 0 || !loanAccountId) return;

    const today = new Date().toISOString().slice(0, 10);
    const newLoan = {
      id: `loan-${Date.now()}`,
      ownerEmail: currentUser.email,
      ownerName: currentUser.name,
      isSharedWithFamily: loanShared,
      loanType, // lend = ให้คนอื่นยืม (เงินออก), borrow = ยืมคนอื่นมา (เงินเข้า)
      personName: loanPerson.trim(),
      totalAmount: amount,
      paidAmount: 0,
      accountId: loanAccountId,
      dueDate: loanDueDate || today,
      note: loanNote.trim() || (loanType === 'lend' ? 'ให้ยืมเงิน' : 'ยืมเงินมา'),
      status: 'active',
      repayments: [],
      createdAt: today,
    };

    updateState((prev) => ({
      ...prev,
      accounts: prev.accounts.map((a) => {
        if (a.id !== loanAccountId) return a;
        return {
          ...a,
          balance:
            loanType === 'lend'
              ? Number(a.balance) - amount
              : Number(a.balance) + amount,
        };
      }),
      loans: [newLoan, ...prev.loans],
    }));

    setLoanPerson('');
    setLoanAmount('');
    setLoanNote('');
    setShowLoanModal(false);
    showToast(
      loanType === 'lend'
        ? `บันทึกให้ "${newLoan.personName}" ยืมเงิน ${formatTHB(amount)} แล้ว`
        : `บันทึกยืมเงินจาก "${newLoan.personName}" ${formatTHB(amount)} แล้ว`
    );
  };

  // Record Loan Repayment (Partial or Full)
  const handleRecordLoanRepayment = (e) => {
    e.preventDefault();
    if (!showRepayLoanModal || !repayAccountId) return;
    const amount = parseFloat(repayAmount);
    if (!amount || amount <= 0) return;

    const targetLoan = showRepayLoanModal;
    const today = new Date().toISOString().slice(0, 10);
    const newPaidAmount = Math.min(
      targetLoan.totalAmount,
      Number(targetLoan.paidAmount) + amount
    );
    const isNowSettled = newPaidAmount >= targetLoan.totalAmount;

    updateState((prev) => ({
      ...prev,
      accounts: prev.accounts.map((a) => {
        if (a.id !== repayAccountId) return a;
        // If 'lend', receiving money back increases our bank balance.
        // If 'borrow', paying back decreases our bank balance.
        return {
          ...a,
          balance:
            targetLoan.loanType === 'lend'
              ? Number(a.balance) + amount
              : Number(a.balance) - amount,
        };
      }),
      loans: prev.loans.map((l) => {
        if (l.id !== targetLoan.id) return l;
        return {
          ...l,
          paidAmount: newPaidAmount,
          status: isNowSettled ? 'settled' : 'active',
          repayments: [
            ...l.repayments,
            {
              id: `rep-${Date.now()}`,
              amount,
              accountId: repayAccountId,
              date: today,
              note: repayNote.trim() || (isNowSettled ? 'ชำระครบเต็มจำนวน' : 'ทยอยชำระคืน'),
            },
          ],
        };
      }),
    }));

    setShowRepayLoanModal(null);
    setRepayAmount('');
    setRepayNote('');
    showToast(
      isNowSettled
        ? `🎉 เคลียร์ยอดกับ "${targetLoan.personName}" ครบ 100% แล้ว!`
        : `บันทึกยอดชำระ ${formatTHB(amount)} เรียบร้อยแล้ว`
    );
  };

  // Copy Loan Summary for LINE
  const handleCopyLoanLineMessage = (loan) => {
    const remaining = Math.max(0, Number(loan.totalAmount) - Number(loan.paidAmount));
    const text =
      loan.loanType === 'lend'
        ? `📌 สรุปยอดเงินยืม (${loan.personName})\n• ยอดยืมทั้งหมด: ${formatTHB(loan.totalAmount)}\n• คืนมาแล้ว: ${formatTHB(loan.paidAmount)}\n• ยอดคงเหลือ: ${formatTHB(remaining)}\nหมายเหตุ: ${loan.note || '-'}`
        : `📌 บันทึกยอดหนี้ที่ยืมจาก (${loan.personName})\n• ยอดทั้งหมด: ${formatTHB(loan.totalAmount)}\n• คืนไปแล้ว: ${formatTHB(loan.paidAmount)}\n• คงเหลือที่ต้องคืน: ${formatTHB(remaining)}`;

    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(text);
      showToast('คัดลอกข้อความสรุปยอดแล้ว ส่งในแชท LINE ได้เลย!');
    }
  };

  // Toggle Account Sharing with Family
  const handleToggleAccountShare = (accountId) => {
    updateState((prev) => ({
      ...prev,
      accounts: prev.accounts.map((a) =>
        a.id === accountId ? { ...a, isSharedWithFamily: !a.isSharedWithFamily } : a
      ),
    }));
    showToast('อัปเดตสถานะการแชร์บัญชีกับคนในบ้านแล้ว');
  };

  // Invite Family Member by Gmail
  const handleInviteFamilyEmail = (e) => {
    e.preventDefault();
    const email = inviteEmailInput.trim().toLowerCase();
    if (!email || !email.includes('@') || !currentFamily) return;

    updateState((prev) => ({
      ...prev,
      familyGroups: prev.familyGroups.map((fg) =>
        fg.id === currentFamily.id && !fg.memberEmails.includes(email)
          ? { ...fg, memberEmails: [...fg.memberEmails, email] }
          : fg
      ),
    }));
    setInviteEmailInput('');
    showToast(`เพิ่ม ${email} เข้าสู่บ้าน "${currentFamily.name}" แล้ว`);
  };

  // Join or Create Family House
  const handleJoinFamilyByCode = (e) => {
    e.preventDefault();
    const code = joinCodeInput.trim().toUpperCase();
    if (!code) return;
    const found = appState.familyGroups.find((fg) => fg.inviteCode.toUpperCase() === code);
    if (!found) {
      showToast('ไม่พบรหัสบ้านนี้ กรุณาตรวจสอบรหัสอีกครั้ง');
      return;
    }
    updateState((prev) => ({
      ...prev,
      familyGroups: prev.familyGroups.map((fg) =>
        fg.id === found.id && !fg.memberEmails.includes(currentUser.email)
          ? { ...fg, memberEmails: [...fg.memberEmails, currentUser.email] }
          : fg
      ),
      users: prev.users.map((u) =>
        u.email === currentUser.email ? { ...u, familyId: found.id } : u
      ),
    }));
    setCurrentUser((prev) => ({ ...prev, familyId: found.id }));
    setJoinCodeInput('');
    showToast(`เข้าร่วม "${found.name}" สำเร็จ!`);
  };

  // Export CSV for Desktop Reporting
  const handleExportCSV = () => {
    const headers = ['วันที่', 'ประเภท', 'หมวดหมู่', 'รายการ', 'จำนวนเงิน', 'ผู้บันทึก', 'แชร์ในบ้าน'];
    const rows = visibleTransactions.map((t) => [
      t.txDate,
      t.type,
      t.category,
      `"${(t.note || '').replace(/"/g, '""')}"`,
      t.amount,
      `"${t.ownerName} (${t.ownerEmail})"`,
      t.isSharedWithFamily ? 'Shared' : 'Personal',
    ]);
    const csvContent =
      '\uFEFF' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `flowwallet-report-${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('ดาวน์โหลดรายงาน CSV สำหรับเปิดใน Excel สำเร็จ');
  };

  if (!hydrated || !appState) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0f172a', color: '#fff' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '2.2rem', marginBottom: 8 }}>💳</div>
          <div style={{ fontWeight: 700 }}>กำลังโหลด FlowWallet...</div>
        </div>
      </div>
    );
  }

  // ============================================================================
  // 1. GOOGLE LOGIN GATE (ต้อง Login Gmail ก่อนเข้าใช้งาน)
  // ============================================================================
  if (!currentUser) {
    return (
      <div
        style={{
          minHeight: '100vh',
          background: 'linear-gradient(135deg, #0f172a 0%, #1e1b4b 55%, #312e81 100%)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 20,
        }}
      >
        <div
          className="card"
          style={{
            maxWidth: 460,
            width: '100%',
            padding: 32,
            borderRadius: 24,
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
          }}
        >
          <div style={{ textAlign: 'center', marginBottom: 24 }}>
            <div
              style={{
                width: 64,
                height: 64,
                borderRadius: 18,
                background: 'linear-gradient(135deg, #4f46e5, #ec4899)',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '2rem',
                marginBottom: 14,
                boxShadow: '0 10px 25px rgba(79, 70, 229, 0.35)',
              }}
            >
              💳
            </div>
            <h1 style={{ fontSize: '1.55rem', fontWeight: 800, color: '#0f172a' }}>
              FlowWallet
            </h1>
            <p style={{ color: '#64748b', fontSize: '0.92rem', marginTop: 4 }}>
              แอปรายรับ-รายจ่าย หลายบัญชี • บัตรเครดิต & PayLater • ยืม/ให้ยืม • แชร์ยอดรวมกับคนในบ้าน
            </p>
          </div>

          {/* Quick 1-Click Gmail Accounts (For testing Multi-user & Family Sharing immediately) */}
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#475569', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.03em' }}>
              คลิกเลือกบัญชี Gmail เพื่อเข้าใช้งานทันที
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {appState.users.map((u) => (
                <button
                  key={u.email}
                  type="button"
                  onClick={() => handleLoginWithGmail(u.email, u.name)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    width: '100%',
                    padding: '12px 16px',
                    borderRadius: 14,
                    border: '1px solid #cbd5e1',
                    background: '#ffffff',
                    cursor: 'pointer',
                    textAlign: 'left',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div
                      style={{
                        width: 40,
                        height: 40,
                        borderRadius: '50%',
                        background: u.email.includes('partner') ? '#db2777' : '#4f46e5',
                        color: '#fff',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontWeight: 700,
                      }}
                    >
                      {u.name.slice(0, 1)}
                    </div>
                    <div>
                      <div style={{ fontWeight: 700, color: '#0f172a', fontSize: '0.95rem' }}>
                        {u.name}
                      </div>
                      <div style={{ color: '#64748b', fontSize: '0.82rem' }}>{u.email}</div>
                    </div>
                  </div>
                  <span className="badge badge-indigo">Google</span>
                </button>
              ))}
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '18px 0' }}>
            <div style={{ flex: 1, height: 1, background: '#e2e8f0' }} />
            <span style={{ fontSize: '0.8rem', color: '#94a3b8', fontWeight: 600 }}>
              หรือเข้าด้วย Gmail อื่นของคุณ
            </span>
            <div style={{ flex: 1, height: 1, background: '#e2e8f0' }} />
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleLoginWithGmail(customGmail, customName);
            }}
          >
            <div className="form-group">
              <label className="form-label">ชื่อเล่น / ชื่อที่ใช้แสดงในบ้าน</label>
              <input
                type="text"
                className="form-input"
                placeholder="เช่น นัท, พ่อ, แม่"
                value={customName}
                onChange={(e) => setCustomName(e.target.value)}
              />
            </div>
            <div className="form-group">
              <label className="form-label">อีเมล Google (Gmail)</label>
              <input
                type="email"
                className="form-input"
                placeholder="yourname@gmail.com"
                value={customGmail}
                onChange={(e) => setCustomGmail(e.target.value)}
                required
              />
            </div>

            {loginError && (
              <div style={{ color: '#dc2626', fontSize: '0.85rem', marginBottom: 12 }}>
                {loginError}
              </div>
            )}

            <button type="submit" className="btn btn-primary" style={{ width: '100%', padding: '12px 16px' }}>
              <span>🔐</span> เข้าสู่ระบบด้วย Gmail
            </button>
          </form>

          {isSupabaseConfigured() && (
            <button
              type="button"
              onClick={startSupabaseGoogleLogin}
              className="btn btn-outline"
              style={{ width: '100%', marginTop: 10 }}
            >
              🌐 Login with Google OAuth (Supabase Cloud)
            </button>
          )}
        </div>
      </div>
    );
  }

  // ============================================================================
  // 2. LOGGED-IN APP SHELL (Responsive Mobile + Desktop)
  // ============================================================================
  return (
    <div className="app-shell">
      {/* Toast Notification */}
      {toastMessage && (
        <div
          style={{
            position: 'fixed',
            bottom: 88,
            right: 20,
            background: '#0f172a',
            color: '#ffffff',
            padding: '12px 18px',
            borderRadius: 14,
            boxShadow: '0 10px 25px rgba(0,0,0,0.25)',
            zIndex: 100,
            fontWeight: 600,
            fontSize: '0.9rem',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <span>✨</span> {toastMessage}
        </div>
      )}

      {/* DESKTOP SIDEBAR */}
      <aside className="desktop-sidebar">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 28, padding: '0 6px' }}>
          <div
            style={{
              width: 42,
              height: 42,
              borderRadius: 12,
              background: 'linear-gradient(135deg, #4f46e5, #ec4899)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '1.35rem',
            }}
          >
            💳
          </div>
          <div>
            <div style={{ fontWeight: 800, fontSize: '1.15rem', letterSpacing: '-0.02em' }}>
              FlowWallet
            </div>
            <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
              Personal & Family Finance
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={() => openNewTransactionModal('expense')}
          className="btn btn-primary"
          style={{ width: '100%', marginBottom: 22, padding: '12px 16px' }}
        >
          <span>＋</span> จดรายรับ / รายจ่าย / รูดบัตร
        </button>

        <nav style={{ flex: 1 }}>
          <button
            type="button"
            className={`sidebar-nav-btn ${activeTab === 'dashboard' ? 'active' : ''}`}
            onClick={() => setActiveTab('dashboard')}
          >
            <span>📊</span> ภาพรวม (Dashboard)
          </button>
          <button
            type="button"
            className={`sidebar-nav-btn ${activeTab === 'accounts' ? 'active' : ''}`}
            onClick={() => setActiveTab('accounts')}
          >
            <span>💳</span> บัญชี & บัตรเครดิต ({visibleAccounts.length})
          </button>
          <button
            type="button"
            className={`sidebar-nav-btn ${activeTab === 'loans' ? 'active' : ''}`}
            onClick={() => setActiveTab('loans')}
          >
            <span>🤝</span> ยืมเงิน & ให้ยืม ({visibleLoans.filter((l) => l.status === 'active').length})
          </button>
          <button
            type="button"
            className={`sidebar-nav-btn ${activeTab === 'reports' ? 'active' : ''}`}
            onClick={() => setActiveTab('reports')}
          >
            <span>📈</span> รายงานวิเคราะห์ (Desktop)
          </button>
          <button
            type="button"
            className={`sidebar-nav-btn ${activeTab === 'family' ? 'active' : ''}`}
            onClick={() => setActiveTab('family')}
          >
            <span>🏠</span> แชร์คนในบ้าน (Family)
          </button>
        </nav>

        {/* Logged-in Gmail Profile & Quick Switcher */}
        <div
          style={{
            background: 'rgba(255,255,255,0.06)',
            borderRadius: 14,
            padding: 14,
            marginTop: 'auto',
          }}
        >
          <div style={{ fontSize: '0.72rem', color: '#94a3b8', marginBottom: 6 }}>
            เข้าสู่ระบบด้วย Gmail:
          </div>
          <div style={{ fontWeight: 700, fontSize: '0.9rem', color: '#fff' }}>
            {currentUser.name}
          </div>
          <div style={{ fontSize: '0.78rem', color: '#cbd5e1', marginBottom: 10, wordBreak: 'break-all' }}>
            {currentUser.email}
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            <button
              type="button"
              onClick={handleLogout}
              className="btn btn-sm"
              style={{
                background: 'rgba(255,255,255,0.12)',
                color: '#fff',
                width: '100%',
              }}
            >
              สลับบัญชี Gmail / ออก
            </button>
          </div>
        </div>
      </aside>

      {/* MAIN AREA */}
      <div className="main-area">
        {/* Sticky Top Header with Personal vs Family View Toggle */}
        <header className="top-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: '1.25rem' }}>
              {viewMode === 'family' ? '🏠' : '👤'}
            </span>
            <div>
              <div style={{ fontWeight: 800, fontSize: '1.02rem' }}>
                {viewMode === 'family'
                  ? currentFamily?.name || 'มุมมองคนในบ้าน'
                  : `กระเป๋าของ ${currentUser.name}`}
              </div>
              <div style={{ fontSize: '0.76rem', color: '#64748b' }}>
                {viewMode === 'family'
                  ? `รวมทุกบัญชีที่คนในบ้านกดแชร์ (${currentFamily?.memberEmails.length || 1} คน)`
                  : `แสดงเฉพาะบัญชีส่วนตัวและบัตรของ ${currentUser.email}`}
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            {/* View Mode Switcher */}
            <div className="mode-switcher">
              <button
                type="button"
                className={`mode-btn ${viewMode === 'personal' ? 'active' : ''}`}
                onClick={() => setViewMode('personal')}
              >
                👤 ส่วนตัว
              </button>
              <button
                type="button"
                className={`mode-btn ${viewMode === 'family' ? 'active' : ''}`}
                onClick={() => setViewMode('family')}
              >
                🏠 ยอดรวมคนในบ้าน
              </button>
            </div>

            <button
              type="button"
              onClick={() => openNewTransactionModal('expense')}
              className="btn btn-primary btn-sm"
            >
              ＋ จดรายการ
            </button>

            <button
              type="button"
              onClick={handleLogout}
              className="btn btn-outline btn-sm"
              title="สลับบัญชี Gmail"
            >
              🔄 สลับ Gmail
            </button>
          </div>
        </header>

        <main className="content-container">
          {/* ================================================================= */}
          {/* TAB 1: DASHBOARD (ภาพรวม) */}
          {/* ================================================================= */}
          {activeTab === 'dashboard' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
              {/* Hero Net Worth Banner */}
              <div className={viewMode === 'family' ? 'hero-card-family' : 'hero-card'}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16 }}>
                  <div>
                    <div style={{ fontSize: '0.82rem', opacity: 0.85, fontWeight: 600, marginBottom: 4 }}>
                      {viewMode === 'family'
                        ? '🏠 ความมั่งคั่งสุทธิรวมของบ้าน (สินทรัพย์ + เงินให้ยืม - หนี้บัตร - หนี้ยืม)'
                        : '💎 ความมั่งคั่งสุทธิของคุณ (Net Worth)'}
                    </div>
                    <div style={{ fontSize: '2.25rem', fontWeight: 800, letterSpacing: '-0.02em' }}>
                      {formatTHB(summary.netWorth)}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <button
                      type="button"
                      onClick={() => openNewTransactionModal('income')}
                      className="btn btn-sm"
                      style={{ background: 'rgba(255,255,255,0.2)', color: '#fff' }}
                    >
                      ＋ รายรับ
                    </button>
                    <button
                      type="button"
                      onClick={() => openNewTransactionModal('expense')}
                      className="btn btn-sm"
                      style={{ background: '#ffffff', color: '#1e1b4b' }}
                    >
                      💳 รูดบัตร / จ่ายเงิน
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowAccountModal(true)}
                      className="btn btn-sm"
                      style={{ background: 'rgba(255,255,255,0.16)', color: '#fff' }}
                    >
                      ＋ เพิ่มบัญชี/บัตร
                    </button>
                  </div>
                </div>

                {/* 4 Key Pillars inside Hero */}
                <div className="grid-4" style={{ marginTop: 22 }}>
                  <div style={{ background: 'rgba(255,255,255,0.12)', padding: 14, borderRadius: 14 }}>
                    <div style={{ fontSize: '0.76rem', opacity: 0.85 }}>🏦 เงินสด & ธนาคารรวม</div>
                    <div style={{ fontSize: '1.2rem', fontWeight: 800, marginTop: 4 }}>
                      {formatTHB(summary.totalAssets)}
                    </div>
                  </div>
                  <div style={{ background: 'rgba(255,255,255,0.12)', padding: 14, borderRadius: 14 }}>
                    <div style={{ fontSize: '0.76rem', opacity: 0.85 }}>💳 หนี้บัตรเครดิต & PayLater</div>
                    <div style={{ fontSize: '1.2rem', fontWeight: 800, marginTop: 4, color: '#fecdd3' }}>
                      -{formatTHB(summary.totalCreditUsed)}
                    </div>
                  </div>
                  <div style={{ background: 'rgba(255,255,255,0.12)', padding: 14, borderRadius: 14 }}>
                    <div style={{ fontSize: '0.76rem', opacity: 0.85 }}>🟢 รอคนคืนเงิน (ให้ยืม)</div>
                    <div style={{ fontSize: '1.2rem', fontWeight: 800, marginTop: 4, color: '#a7f3d0' }}>
                      +{formatTHB(summary.totalReceivableLoans)}
                    </div>
                  </div>
                  <div style={{ background: 'rgba(255,255,255,0.12)', padding: 14, borderRadius: 14 }}>
                    <div style={{ fontSize: '0.76rem', opacity: 0.85 }}>🟠 หนี้ที่ต้องคืนคนอื่น (ยืมมา)</div>
                    <div style={{ fontSize: '1.2rem', fontWeight: 800, marginTop: 4, color: '#fde68a' }}>
                      -{formatTHB(summary.totalPayableLoans)}
                    </div>
                  </div>
                </div>
              </div>

              {/* Quick Section: Asset Accounts & Credit Cards side by side */}
              <div className="grid-2">
                {/* Asset Wallets */}
                <div className="card">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                    <div>
                      <h2 style={{ fontSize: '1.05rem', fontWeight: 800 }}>🏦 บัญชีเงินสด & ธนาคาร</h2>
                      <p style={{ fontSize: '0.8rem', color: '#64748b' }}>เงินพร้อมใช้ทั้งหมด</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setAccType('bank');
                        setShowAccountModal(true);
                      }}
                      className="btn btn-outline btn-sm"
                    >
                      ＋ เพิ่มบัญชี
                    </button>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {assetAccounts.map((acc) => (
                      <div
                        key={acc.id}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '12px 14px',
                          borderRadius: 14,
                          border: '1px solid #e2e8f0',
                          background: '#f8fafc',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                          <div
                            style={{
                              width: 40,
                              height: 40,
                              borderRadius: 12,
                              background: acc.color || '#059669',
                              color: '#fff',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontSize: '1.2rem',
                            }}
                          >
                            {ACCOUNT_TYPE_META[acc.type]?.icon || '🏦'}
                          </div>
                          <div>
                            <div style={{ fontWeight: 700, fontSize: '0.94rem', display: 'flex', alignItems: 'center', gap: 6 }}>
                              {acc.name}
                              {acc.isSharedWithFamily ? (
                                <span className="badge badge-pink">🏠 แชร์กับบ้าน</span>
                              ) : (
                                <span className="badge badge-slate">🔒 ส่วนตัว</span>
                              )}
                            </div>
                            <div style={{ fontSize: '0.76rem', color: '#64748b' }}>
                              เจ้าของ: {acc.ownerName}
                            </div>
                          </div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontWeight: 800, fontSize: '1.02rem', color: '#059669' }}>
                            {formatTHB(acc.balance)}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Credit Cards & BNPL (ใช้ก่อนจ่ายทีหลัง) */}
                <div className="card">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                    <div>
                      <h2 style={{ fontSize: '1.05rem', fontWeight: 800 }}>💳 บัตรเครดิต & ใช้ก่อนจ่ายทีหลัง</h2>
                      <p style={{ fontSize: '0.8rem', color: '#64748b' }}>เช็กยอดรูด วงเงินคงเหลือ และจ่ายบิล</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setAccType('credit_card');
                        setShowAccountModal(true);
                      }}
                      className="btn btn-outline btn-sm"
                    >
                      ＋ เพิ่มบัตร/PayLater
                    </button>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {creditAccounts.map((card) => {
                      const available = Math.max(0, Number(card.creditLimit) - Number(card.usedAmount));
                      const usagePct =
                        card.creditLimit > 0
                          ? Math.min(100, Math.round((card.usedAmount / card.creditLimit) * 100))
                          : 0;
                      return (
                        <div
                          key={card.id}
                          style={{
                            padding: 14,
                            borderRadius: 14,
                            border: '1px solid #e2e8f0',
                            background: '#fff',
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                            <div>
                              <div style={{ fontWeight: 700, fontSize: '0.95rem', display: 'flex', alignItems: 'center', gap: 6 }}>
                                <span>{ACCOUNT_TYPE_META[card.type]?.icon}</span>
                                {card.name}
                                {card.isSharedWithFamily && (
                                  <span className="badge badge-pink">🏠 แชร์บ้าน</span>
                                )}
                              </div>
                              <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                                สรุปยอดวันที่ {card.statementDay} • จ่ายวันที่ {card.dueDay} • {card.ownerName}
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={() => {
                                setShowPayCardModal(card);
                                setPayCardAmount(String(card.usedAmount));
                                setPayCardFromAccId(assetAccounts[0]?.id || '');
                              }}
                              className="btn btn-primary btn-sm"
                            >
                              จ่ายบิลบัตร
                            </button>
                          </div>

                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', marginBottom: 6 }}>
                            <span>
                              รูดใช้ไป: <strong style={{ color: '#dc2626' }}>{formatTHB(card.usedAmount)}</strong>
                            </span>
                            <span>
                              วงเงินคงเหลือ: <strong style={{ color: '#059669' }}>{formatTHB(available)}</strong>
                            </span>
                          </div>
                          <div className="progress-track">
                            <div
                              className="progress-fill"
                              style={{
                                width: `${usagePct}%`,
                                background: usagePct > 80 ? '#ef4444' : '#4f46e5',
                              }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Recent Transactions List */}
              <div className="card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                  <div>
                    <h2 style={{ fontSize: '1.05rem', fontWeight: 800 }}>📝 รายการเคลื่อนไหวล่าสุด</h2>
                    <p style={{ fontSize: '0.8rem', color: '#64748b' }}>
                      รวมรายการรับ-จ่าย, รูดบัตรเครดิต และโอนจ่ายบิล
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => openNewTransactionModal('expense')}
                    className="btn btn-primary btn-sm"
                  >
                    ＋ เพิ่มรายการ
                  </button>
                </div>

                {visibleTransactions.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: 28, color: '#64748b' }}>
                    ยังไม่มีรายการบันทึก กดปุ่ม &ldquo;＋ เพิ่มรายการ&rdquo; เพื่อเริ่มต้นได้เลย
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {visibleTransactions.slice(0, 12).map((tx) => {
                      const allCats = [...EXPENSE_CATEGORIES, ...INCOME_CATEGORIES];
                      const cat = allCats.find((c) => c.id === tx.category) || {
                        icon: tx.type === 'card_payment' ? '💳' : '🔄',
                        label: tx.type === 'card_payment' ? 'จ่ายบิลบัตรเครดิต' : 'โอนเงิน',
                      };
                      const acc = appState.accounts.find((a) => a.id === tx.accountId);
                      return (
                        <div
                          key={tx.id}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '12px 14px',
                            borderRadius: 14,
                            border: '1px solid #f1f5f9',
                            background: '#f8fafc',
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                            <div
                              style={{
                                width: 42,
                                height: 42,
                                borderRadius: 12,
                                background: '#ffffff',
                                border: '1px solid #e2e8f0',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: '1.25rem',
                              }}
                            >
                              {cat.icon}
                            </div>
                            <div>
                              <div style={{ fontWeight: 700, fontSize: '0.94rem', display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                                {tx.note}
                                {tx.isSharedWithFamily && (
                                  <span className="badge badge-pink">🏠 แชร์บ้าน</span>
                                )}
                              </div>
                              <div style={{ fontSize: '0.76rem', color: '#64748b' }}>
                                {cat.label} • {acc?.name || 'บัญชี'} • โดย {tx.ownerName} • {tx.txDate}
                              </div>
                            </div>
                          </div>

                          <div
                            style={{
                              fontWeight: 800,
                              fontSize: '1rem',
                              color:
                                tx.type === 'income'
                                  ? '#059669'
                                  : tx.type === 'card_payment' || tx.type === 'transfer'
                                  ? '#4f46e5'
                                  : '#dc2626',
                            }}
                          >
                            {tx.type === 'income' ? '+' : tx.type === 'expense' ? '-' : ''}
                            {formatTHB(tx.amount)}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ================================================================= */}
          {/* TAB 2: ACCOUNTS, CREDIT CARDS & INSTALLMENTS (บัญชี & บัตรเครดิต) */}
          {/* ================================================================= */}
          {activeTab === 'accounts' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
                <div>
                  <h1 style={{ fontSize: '1.35rem', fontWeight: 800 }}>
                    💳 จัดการบัญชีธนาคาร, บัตรเครดิต & ใช้ก่อนจ่ายทีหลัง
                  </h1>
                  <p style={{ fontSize: '0.86rem', color: '#64748b' }}>
                    แยกกระเป๋าสินทรัพย์และวงเงินบัตรเครดิตชัดเจน พร้อมระบบตัดจ่ายบิลและผ่อนสินค้า
                  </p>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    type="button"
                    onClick={() => setShowInstallmentModal(true)}
                    className="btn btn-outline"
                  >
                    📅 + เพิ่มรายการผ่อนสินค้า
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowAccountModal(true)}
                    className="btn btn-primary"
                  >
                    ＋ เพิ่มบัญชี / บัตรเครดิต
                  </button>
                </div>
              </div>

              {/* Credit Card Visual Cards */}
              <div>
                <h2 style={{ fontSize: '1.05rem', fontWeight: 800, marginBottom: 12 }}>
                  ⚡ บัตรเครดิต & สินเชื่อใช้ก่อนจ่ายทีหลัง (Credit Card / BNPL)
                </h2>
                <div className="grid-3">
                  {creditAccounts.map((card) => {
                    const available = Math.max(0, Number(card.creditLimit) - Number(card.usedAmount));
                    const usagePct =
                      card.creditLimit > 0
                        ? Math.min(100, Math.round((card.usedAmount / card.creditLimit) * 100))
                        : 0;
                    return (
                      <div
                        key={card.id}
                        className="credit-card-visual"
                        style={{
                          background: `linear-gradient(135deg, ${card.color || '#1e293b'} 0%, #0f172a 100%)`,
                        }}
                      >
                        <div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span className="badge" style={{ background: 'rgba(255,255,255,0.2)', color: '#fff' }}>
                              {ACCOUNT_TYPE_META[card.type]?.badge}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleToggleAccountShare(card.id)}
                              className="badge"
                              style={{
                                background: card.isSharedWithFamily ? '#ec4899' : 'rgba(255,255,255,0.15)',
                                color: '#fff',
                                border: 'none',
                                cursor: 'pointer',
                              }}
                            >
                              {card.isSharedWithFamily ? '🏠 แชร์กับบ้าน' : '🔒 ส่วนตัว (กดเพื่อแชร์)'}
                            </button>
                          </div>
                          <div style={{ fontSize: '1.15rem', fontWeight: 800, marginTop: 12 }}>
                            {card.name}
                          </div>
                          <div style={{ fontSize: '0.78rem', opacity: 0.8 }}>
                            ผู้ถือบัตร: {card.ownerName} • สรุปบิลวันที่ {card.statementDay} / จ่ายวันที่ {card.dueDay}
                          </div>
                        </div>

                        <div style={{ marginTop: 18 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', marginBottom: 6 }}>
                            <span>ยอดใช้ไป: <strong>{formatTHB(card.usedAmount)}</strong></span>
                            <span>วงเงินเหลือ: <strong>{formatTHB(available)}</strong></span>
                          </div>
                          <div className="progress-track" style={{ background: 'rgba(255,255,255,0.2)' }}>
                            <div
                              className="progress-fill"
                              style={{
                                width: `${usagePct}%`,
                                background: usagePct > 80 ? '#f87171' : '#38bdf8',
                              }}
                            />
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 12 }}>
                            <span style={{ fontSize: '0.75rem', opacity: 0.8 }}>
                              วงเงินรวม {formatTHB(card.creditLimit)}
                            </span>
                            <button
                              type="button"
                              onClick={() => {
                                setShowPayCardModal(card);
                                setPayCardAmount(String(card.usedAmount));
                                setPayCardFromAccId(assetAccounts[0]?.id || '');
                              }}
                              className="btn btn-sm"
                              style={{ background: '#ffffff', color: '#0f172a', fontWeight: 700 }}
                            >
                              💳 โอนจ่ายบิลบัตร
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Active Installments (ระบบผ่อนชำระรายเดือน) */}
              <div className="card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                  <div>
                    <h2 style={{ fontSize: '1.05rem', fontWeight: 800 }}>
                      📅 รายการผ่อนชำระรายเดือน (Installment Plans)
                    </h2>
                    <p style={{ fontSize: '0.8rem', color: '#64748b' }}>
                      ติดตามยอดผ่อน 0% หรือผ่อนของผ่านบัตรเครดิต/PayLater ว่าจ่ายไปกี่งวดแล้ว
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowInstallmentModal(true)}
                    className="btn btn-outline btn-sm"
                  >
                    ＋ เพิ่มรายการผ่อน
                  </button>
                </div>

                {visibleInstallments.length === 0 ? (
                  <div style={{ padding: 20, textAlign: 'center', color: '#64748b' }}>
                    ยังไม่มีรายการผ่อนชำระ
                  </div>
                ) : (
                  <div className="grid-2">
                    {visibleInstallments.map((inst) => {
                      const card = appState.accounts.find((a) => a.id === inst.accountId);
                      const pct = Math.min(100, Math.round((inst.paidMonths / inst.totalMonths) * 100));
                      const remainingMonths = Math.max(0, inst.totalMonths - inst.paidMonths);
                      return (
                        <div
                          key={inst.id}
                          style={{
                            padding: 16,
                            borderRadius: 14,
                            border: '1px solid #e2e8f0',
                            background: '#f8fafc',
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                            <div>
                              <div style={{ fontWeight: 700, fontSize: '0.95rem' }}>{inst.title}</div>
                              <div style={{ fontSize: '0.78rem', color: '#64748b' }}>
                                บัตร: {card?.name || '-'} • ผ่อนเดือนละ{' '}
                                <strong style={{ color: '#4f46e5' }}>{formatTHB(inst.monthlyAmount)}</strong>
                              </div>
                            </div>
                            <span className="badge badge-indigo">
                              งวด {inst.paidMonths}/{inst.totalMonths}
                            </span>
                          </div>
                          <div className="progress-track" style={{ marginBottom: 10 }}>
                            <div
                              className="progress-fill"
                              style={{ width: `${pct}%`, background: '#10b981' }}
                            />
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.8rem' }}>
                            <span>
                              ยอดรวม {formatTHB(inst.totalAmount)} (เหลืออีก {remainingMonths} งวด)
                            </span>
                            {inst.paidMonths < inst.totalMonths && (
                              <button
                                type="button"
                                onClick={() => handleAdvanceInstallmentMonth(inst)}
                                className="btn btn-outline btn-sm"
                              >
                                ✅ บันทึกจ่ายงวดถัดไป
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Asset Accounts List */}
              <div className="card">
                <h2 style={{ fontSize: '1.05rem', fontWeight: 800, marginBottom: 12 }}>
                  🏦 บัญชีสินทรัพย์ (เงินสด / ธนาคาร / E-Wallet)
                </h2>
                <div className="grid-3">
                  {assetAccounts.map((acc) => (
                    <div
                      key={acc.id}
                      style={{
                        padding: 16,
                        borderRadius: 16,
                        border: '1px solid #e2e8f0',
                        background: '#ffffff',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'space-between',
                        gap: 12,
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span className="badge badge-emerald">
                          {ACCOUNT_TYPE_META[acc.type]?.icon} {ACCOUNT_TYPE_META[acc.type]?.badge}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleToggleAccountShare(acc.id)}
                          className={`badge ${acc.isSharedWithFamily ? 'badge-pink' : 'badge-slate'}`}
                          style={{ border: 'none', cursor: 'pointer' }}
                        >
                          {acc.isSharedWithFamily ? '🏠 แชร์กับบ้าน' : '🔒 ส่วนตัว'}
                        </button>
                      </div>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: '1rem' }}>{acc.name}</div>
                        <div style={{ fontSize: '0.76rem', color: '#64748b' }}>โดย {acc.ownerName}</div>
                      </div>
                      <div style={{ fontSize: '1.35rem', fontWeight: 800, color: '#059669' }}>
                        {formatTHB(acc.balance)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ================================================================= */}
          {/* TAB 3: LOANS & DEBT TRACKING (ยืมเงิน & ให้คนอื่นยืมเงิน) */}
          {/* ================================================================= */}
          {activeTab === 'loans' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
                <div>
                  <h1 style={{ fontSize: '1.35rem', fontWeight: 800 }}>
                    🤝 ระบบติดตามการยืมเงิน & ให้คนอื่นยืมเงิน
                  </h1>
                  <p style={{ fontSize: '0.86rem', color: '#64748b' }}>
                    แยกยอดลูกหนี้/เจ้าหนี้ออกจากค่าใช้จ่ายปกติ รองรับการทยอยคืนเงินและคัดลอกข้อความทวงถามทาง LINE
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setLoanAccountId(assetAccounts[0]?.id || '');
                    setShowLoanModal(true);
                  }}
                  className="btn btn-primary"
                >
                  ＋ สร้างรายการยืม / ให้ยืม
                </button>
              </div>

              <div className="grid-2">
                {/* LEND: ลูกหนี้ของเรา (เราให้คนอื่นยืม) */}
                <div className="card">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                    <div>
                      <h2 style={{ fontSize: '1.05rem', fontWeight: 800, color: '#065f46' }}>
                        🟢 ลูกหนี้ (เราให้คนอื่นยืม - รอรับคืน)
                      </h2>
                      <p style={{ fontSize: '0.8rem', color: '#64748b' }}>
                        ยอดรอรับคืนทั้งหมด: <strong>{formatTHB(summary.totalReceivableLoans)}</strong>
                      </p>
                    </div>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {visibleLoans
                      .filter((l) => l.loanType === 'lend')
                      .map((loan) => {
                        const remaining = Math.max(0, Number(loan.totalAmount) - Number(loan.paidAmount));
                        const pct = Math.min(
                          100,
                          Math.round((Number(loan.paidAmount) / Number(loan.totalAmount)) * 100)
                        );
                        return (
                          <div
                            key={loan.id}
                            style={{
                              padding: 16,
                              borderRadius: 16,
                              border: '1px solid #d1fae5',
                              background: loan.status === 'settled' ? '#f8fafc' : '#ecfdf5',
                            }}
                          >
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                              <div>
                                <div style={{ fontWeight: 800, fontSize: '1rem', display: 'flex', alignItems: 'center', gap: 6 }}>
                                  👤 {loan.personName}
                                  {loan.status === 'settled' ? (
                                    <span className="badge badge-emerald">✅ คืนครบแล้ว</span>
                                  ) : (
                                    <span className="badge badge-amber">ค้าง {formatTHB(remaining)}</span>
                                  )}
                                </div>
                                <div style={{ fontSize: '0.8rem', color: '#475569', marginTop: 2 }}>
                                  {loan.note} • นัดคืน: {loan.dueDate || '-'}
                                </div>
                              </div>
                              <div style={{ display: 'flex', gap: 6 }}>
                                <button
                                  type="button"
                                  onClick={() => handleCopyLoanLineMessage(loan)}
                                  className="btn btn-outline btn-sm"
                                  title="คัดลอกส่ง LINE"
                                >
                                  📋 ส่ง LINE
                                </button>
                                {loan.status === 'active' && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setShowRepayLoanModal(loan);
                                      setRepayAmount(String(remaining));
                                      setRepayAccountId(assetAccounts[0]?.id || loan.accountId);
                                    }}
                                    className="btn btn-success btn-sm"
                                  >
                                    รับเงินคืน
                                  </button>
                                )}
                              </div>
                            </div>

                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', marginBottom: 6 }}>
                              <span>คืนมาแล้ว: {formatTHB(loan.paidAmount)}</span>
                              <span>จากยอดยืมรวม: {formatTHB(loan.totalAmount)} ({pct}%)</span>
                            </div>
                            <div className="progress-track">
                              <div
                                className="progress-fill"
                                style={{ width: `${pct}%`, background: '#10b981' }}
                              />
                            </div>

                            {loan.repayments?.length > 0 && (
                              <div style={{ marginTop: 10, fontSize: '0.76rem', color: '#475569' }}>
                                <strong>ประวัติการคืนเงิน:</strong>
                                {loan.repayments.map((r) => (
                                  <div key={r.id}>
                                    • {r.date}: +{formatTHB(r.amount)} ({r.note})
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      })}
                  </div>
                </div>

                {/* BORROW: เจ้าหนี้ของเรา (เรายืมคนอื่นมา) */}
                <div className="card">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                    <div>
                      <h2 style={{ fontSize: '1.05rem', fontWeight: 800, color: '#92400e' }}>
                        🟠 เจ้าหนี้ (เรายืมคนอื่นมา - ต้องจ่ายคืน)
                      </h2>
                      <p style={{ fontSize: '0.8rem', color: '#64748b' }}>
                        ยอดที่ต้องคืนทั้งหมด: <strong>{formatTHB(summary.totalPayableLoans)}</strong>
                      </p>
                    </div>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {visibleLoans
                      .filter((l) => l.loanType === 'borrow')
                      .map((loan) => {
                        const remaining = Math.max(0, Number(loan.totalAmount) - Number(loan.paidAmount));
                        const pct = Math.min(
                          100,
                          Math.round((Number(loan.paidAmount) / Number(loan.totalAmount)) * 100)
                        );
                        return (
                          <div
                            key={loan.id}
                            style={{
                              padding: 16,
                              borderRadius: 16,
                              border: '1px solid #fde68a',
                              background: loan.status === 'settled' ? '#f8fafc' : '#fffbeb',
                            }}
                          >
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                              <div>
                                <div style={{ fontWeight: 800, fontSize: '1rem', display: 'flex', alignItems: 'center', gap: 6 }}>
                                  👤 {loan.personName}
                                  {loan.status === 'settled' ? (
                                    <span className="badge badge-emerald">✅ จ่ายคืนครบแล้ว</span>
                                  ) : (
                                    <span className="badge badge-red">เหลือคืน {formatTHB(remaining)}</span>
                                  )}
                                </div>
                                <div style={{ fontSize: '0.8rem', color: '#475569', marginTop: 2 }}>
                                  {loan.note} • กำหนดคืน: {loan.dueDate || '-'}
                                </div>
                              </div>
                              <div style={{ display: 'flex', gap: 6 }}>
                                {loan.status === 'active' && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setShowRepayLoanModal(loan);
                                      setRepayAmount(String(remaining));
                                      setRepayAccountId(assetAccounts[0]?.id || loan.accountId);
                                    }}
                                    className="btn btn-primary btn-sm"
                                  >
                                    โอนจ่ายคืน
                                  </button>
                                )}
                              </div>
                            </div>

                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', marginBottom: 6 }}>
                              <span>จ่ายคืนแล้ว: {formatTHB(loan.paidAmount)}</span>
                              <span>จากยอดรวม: {formatTHB(loan.totalAmount)} ({pct}%)</span>
                            </div>
                            <div className="progress-track">
                              <div
                                className="progress-fill"
                                style={{ width: `${pct}%`, background: '#f59e0b' }}
                              />
                            </div>

                            {loan.repayments?.length > 0 && (
                              <div style={{ marginTop: 10, fontSize: '0.76rem', color: '#475569' }}>
                                <strong>ประวัติการจ่ายคืน:</strong>
                                {loan.repayments.map((r) => (
                                  <div key={r.id}>
                                    • {r.date}: -{formatTHB(r.amount)} ({r.note})
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      })}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ================================================================= */}
          {/* TAB 4: DESKTOP ANALYTICS & REPORTS (รายงานวิเคราะห์) */}
          {/* ================================================================= */}
          {activeTab === 'reports' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
                <div>
                  <h1 style={{ fontSize: '1.35rem', fontWeight: 800 }}>
                    📈 รายงานวิเคราะห์การเงิน (Desktop & Mobile Report)
                  </h1>
                  <p style={{ fontSize: '0.86rem', color: '#64748b' }}>
                    สรุปสัดส่วนค่าใช้จ่ายตามหมวดหมู่ เทียบรายรับ-รายจ่าย และส่งออกไฟล์ CSV สำหรับ Excel
                  </p>
                </div>
                <button type="button" onClick={handleExportCSV} className="btn btn-primary">
                  📥 ดาวน์โหลดรายงาน CSV (Excel)
                </button>
              </div>

              <div className="grid-3">
                <div className="card">
                  <div style={{ fontSize: '0.82rem', color: '#64748b' }}>รายรับรวมทั้งหมด</div>
                  <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#059669', marginTop: 4 }}>
                    +{formatTHB(summary.totalIncome)}
                  </div>
                </div>
                <div className="card">
                  <div style={{ fontSize: '0.82rem', color: '#64748b' }}>รายจ่ายรวมทั้งหมด (เงินสด + รูดบัตร)</div>
                  <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#dc2626', marginTop: 4 }}>
                    -{formatTHB(summary.totalExpense)}
                  </div>
                </div>
                <div className="card">
                  <div style={{ fontSize: '0.82rem', color: '#64748b' }}>กระแสเงินสดสุทธิ (รายรับ - รายจ่าย)</div>
                  <div
                    style={{
                      fontSize: '1.6rem',
                      fontWeight: 800,
                      color: summary.totalIncome - summary.totalExpense >= 0 ? '#4f46e5' : '#dc2626',
                      marginTop: 4,
                    }}
                  >
                    {formatTHB(summary.totalIncome - summary.totalExpense)}
                  </div>
                </div>
              </div>

              <div className="grid-2">
                {/* Expense by Category Breakdown */}
                <div className="card">
                  <h2 style={{ fontSize: '1.05rem', fontWeight: 800, marginBottom: 14 }}>
                    🍩 สัดส่วนรายจ่ายแยกตามหมวดหมู่
                  </h2>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {EXPENSE_CATEGORIES.map((cat) => {
                      const catSum = visibleTransactions
                        .filter((t) => t.type === 'expense' && t.category === cat.id)
                        .reduce((s, t) => s + Number(t.amount || 0), 0);
                      if (catSum <= 0) return null;
                      const pct =
                        summary.totalExpense > 0
                          ? Math.round((catSum / summary.totalExpense) * 100)
                          : 0;
                      return (
                        <div key={cat.id}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.88rem', marginBottom: 4 }}>
                            <span>
                              {cat.icon} <strong>{cat.label}</strong>
                            </span>
                            <span>
                              <strong>{formatTHB(catSum)}</strong> ({pct}%)
                            </span>
                          </div>
                          <div className="progress-track">
                            <div
                              className="progress-fill"
                              style={{ width: `${pct}%`, background: cat.color }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Member Breakdown (Who spent / contributed in Family) */}
                <div className="card">
                  <h2 style={{ fontSize: '1.05rem', fontWeight: 800, marginBottom: 14 }}>
                    👨‍👩‍👧 สรุปยอดตามสมาชิกในบ้าน (Gmail)
                  </h2>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {appState.users.map((u) => {
                      const userAssets = visibleAccounts
                        .filter((a) => a.ownerEmail === u.email && !ACCOUNT_TYPE_META[a.type]?.isLiability)
                        .reduce((s, a) => s + Number(a.balance || 0), 0);
                      const userCardDebt = visibleAccounts
                        .filter((a) => a.ownerEmail === u.email && ACCOUNT_TYPE_META[a.type]?.isLiability)
                        .reduce((s, a) => s + Number(a.usedAmount || 0), 0);
                      const userExpense = visibleTransactions
                        .filter((t) => t.ownerEmail === u.email && t.type === 'expense')
                        .reduce((s, t) => s + Number(t.amount || 0), 0);

                      return (
                        <div
                          key={u.email}
                          style={{
                            padding: 14,
                            borderRadius: 14,
                            border: '1px solid #e2e8f0',
                            background: '#f8fafc',
                          }}
                        >
                          <div style={{ fontWeight: 700, fontSize: '0.95rem' }}>
                            👤 {u.name} <span style={{ color: '#64748b', fontWeight: 400 }}>({u.email})</span>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8, fontSize: '0.82rem', flexWrap: 'wrap', gap: 8 }}>
                            <span>สินทรัพย์: <strong style={{ color: '#059669' }}>{formatTHB(userAssets)}</strong></span>
                            <span>หนี้บัตร: <strong style={{ color: '#dc2626' }}>{formatTHB(userCardDebt)}</strong></span>
                            <span>จ่ายเดือนนี้: <strong>{formatTHB(userExpense)}</strong></span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ================================================================= */}
          {/* TAB 5: FAMILY SHARING (แชร์ให้เห็นยอดรวมกับคนในบ้าน) */}
          {/* ================================================================= */}
          {activeTab === 'family' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
              <div>
                <h1 style={{ fontSize: '1.35rem', fontWeight: 800 }}>
                  🏠 พื้นที่ครอบครัว & แชร์ยอดรวมกับคนในบ้าน
                </h1>
                <p style={{ fontSize: '0.86rem', color: '#64748b' }}>
                  ชวนคนในบ้านด้วย Gmail หรือรหัสเข้าบ้าน และเลือกเปิด/ปิดได้ว่าบัญชีใบไหนอยากแชร์ให้คนในบ้านเห็นยอดรวม
                </p>
              </div>

              <div className="grid-2">
                {/* Family Group Info & Invite by Gmail */}
                <div className="card">
                  <h2 style={{ fontSize: '1.05rem', fontWeight: 800, marginBottom: 8 }}>
                    👨‍👩‍👧‍👦 บ้านปัจจุบันของคุณ: {currentFamily?.name || 'ยังไม่ได้อยู่ในบ้าน'}
                  </h2>
                  {currentFamily && (
                    <>
                      <div
                        style={{
                          padding: 14,
                          borderRadius: 14,
                          background: '#eef2ff',
                          border: '1px solid #c7d2fe',
                          marginBottom: 16,
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                        }}
                      >
                        <div>
                          <div style={{ fontSize: '0.78rem', color: '#4338ca', fontWeight: 600 }}>
                            รหัสเชิญคนในบ้าน (Invite Code)
                          </div>
                          <div style={{ fontSize: '1.35rem', fontWeight: 800, color: '#1e1b4b', letterSpacing: '0.06em' }}>
                            {currentFamily.inviteCode}
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            if (typeof navigator !== 'undefined' && navigator.clipboard) {
                              navigator.clipboard.writeText(currentFamily.inviteCode);
                              showToast(`คัดลอกรหัสเข้าบ้าน ${currentFamily.inviteCode} แล้ว!`);
                            }
                          }}
                          className="btn btn-primary btn-sm"
                        >
                          คัดลอกรหัส
                        </button>
                      </div>

                      <div style={{ marginBottom: 16 }}>
                        <div style={{ fontSize: '0.85rem', fontWeight: 700, marginBottom: 8 }}>
                          สมาชิกในบ้าน ({currentFamily.memberEmails.length} คน):
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                          {currentFamily.memberEmails.map((email) => {
                            const memberObj = appState.users.find((u) => u.email === email);
                            return (
                              <div
                                key={email}
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'space-between',
                                  padding: '8px 12px',
                                  borderRadius: 10,
                                  background: '#f8fafc',
                                  border: '1px solid #e2e8f0',
                                }}
                              >
                                <span>
                                  <strong>{memberObj?.name || email.split('@')[0]}</strong> ({email})
                                </span>
                                {email === currentUser.email && (
                                  <span className="badge badge-indigo">คุณ</span>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      <form onSubmit={handleInviteFamilyEmail}>
                        <div className="form-group">
                          <label className="form-label">ชวนคนในบ้านเพิ่มด้วย Gmail</label>
                          <div style={{ display: 'flex', gap: 8 }}>
                            <input
                              type="email"
                              className="form-input"
                              placeholder="family.member@gmail.com"
                              value={inviteEmailInput}
                              onChange={(e) => setInviteEmailInput(e.target.value)}
                              required
                            />
                            <button type="submit" className="btn btn-primary">
                              ＋ ชวนเข้าบ้าน
                            </button>
                          </div>
                        </div>
                      </form>
                    </>
                  )}
                </div>

                {/* Privacy Toggle for My Accounts */}
                <div className="card">
                  <h2 style={{ fontSize: '1.05rem', fontWeight: 800, marginBottom: 6 }}>
                    🔒 ตั้งค่าการแชร์บัญชีของฉัน ({currentUser.name})
                  </h2>
                  <p style={{ fontSize: '0.8rem', color: '#64748b', marginBottom: 14 }}>
                    เลือกเปิด <strong>&ldquo;🏠 แชร์กับบ้าน&rdquo;</strong> เฉพาะบัญชีหรือบัตรเครดิตที่ต้องการให้นำไปคิดยอดรวมกับคนในบ้าน
                  </p>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {appState.accounts
                      .filter((a) => a.ownerEmail === currentUser.email)
                      .map((acc) => (
                        <div
                          key={acc.id}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '12px 14px',
                            borderRadius: 12,
                            border: '1px solid #e2e8f0',
                          }}
                        >
                          <div>
                            <div style={{ fontWeight: 700, fontSize: '0.92rem' }}>
                              {ACCOUNT_TYPE_META[acc.type]?.icon} {acc.name}
                            </div>
                            <div style={{ fontSize: '0.78rem', color: '#64748b' }}>
                              {ACCOUNT_TYPE_META[acc.type]?.isLiability
                                ? `หนี้ค้าง: ${formatTHB(acc.usedAmount)}`
                                : `คงเหลือ: ${formatTHB(acc.balance)}`}
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleToggleAccountShare(acc.id)}
                            className={`btn btn-sm ${
                              acc.isSharedWithFamily ? 'btn-primary' : 'btn-outline'
                            }`}
                          >
                            {acc.isSharedWithFamily ? '🏠 แชร์กับบ้านอยู่' : '🔒 ส่วนตัว (กดเพื่อแชร์)'}
                          </button>
                        </div>
                      ))}
                  </div>

                  <div style={{ marginTop: 22, paddingTop: 16, borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.8rem', color: '#64748b' }}>
                      ต้องการรีเซ็ตข้อมูลตัวอย่างเริ่มต้นใหม่?
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        const fresh = createInitialSeedData();
                        saveAppState(fresh);
                        setAppState(fresh);
                        showToast('รีเซ็ตข้อมูลตัวอย่างเริ่มต้นเรียบร้อยแล้ว');
                      }}
                      className="btn btn-outline btn-sm"
                    >
                      🔄 รีเซ็ตข้อมูลตัวอย่าง
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* MOBILE BOTTOM NAVIGATION BAR */}
      <nav className="mobile-bottom-nav">
        <button
          type="button"
          className={`mobile-nav-btn ${activeTab === 'dashboard' ? 'active' : ''}`}
          onClick={() => setActiveTab('dashboard')}
        >
          <span style={{ fontSize: '1.2rem' }}>📊</span>
          <span>ภาพรวม</span>
        </button>
        <button
          type="button"
          className={`mobile-nav-btn ${activeTab === 'accounts' ? 'active' : ''}`}
          onClick={() => setActiveTab('accounts')}
        >
          <span style={{ fontSize: '1.2rem' }}>💳</span>
          <span>บัญชี/บัตร</span>
        </button>
        <button
          type="button"
          className="mobile-fab"
          onClick={() => openNewTransactionModal('expense')}
          aria-label="จดรายการ"
        >
          ＋
        </button>
        <button
          type="button"
          className={`mobile-nav-btn ${activeTab === 'loans' ? 'active' : ''}`}
          onClick={() => setActiveTab('loans')}
        >
          <span style={{ fontSize: '1.2rem' }}>🤝</span>
          <span>ยืม/ให้ยืม</span>
        </button>
        <button
          type="button"
          className={`mobile-nav-btn ${activeTab === 'family' ? 'active' : ''}`}
          onClick={() => setActiveTab('family')}
        >
          <span style={{ fontSize: '1.2rem' }}>🏠</span>
          <span>คนในบ้าน</span>
        </button>
      </nav>

      {/* ===================================================================== */}
      {/* MODAL 1: บันทึกรายรับ / รายจ่าย / รูดบัตรเครดิต / โอนเงิน */}
      {/* ===================================================================== */}
      {showTxModal && (
        <div className="modal-backdrop" onClick={() => setShowTxModal(false)}>
          <div className="modal-panel" onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ fontSize: '1.15rem', fontWeight: 800 }}>📝 บันทึกรายการใหม่</h3>
              <button type="button" onClick={() => setShowTxModal(false)} className="btn btn-ghost btn-sm">
                ✕
              </button>
            </div>

            <div className="mode-switcher" style={{ width: '100%', marginBottom: 16 }}>
              <button
                type="button"
                className={`mode-btn ${txType === 'expense' ? 'active' : ''}`}
                style={{ flex: 1, justifyContent: 'center' }}
                onClick={() => {
                  setTxType('expense');
                  setTxCategory('food');
                }}
              >
                💸 รายจ่าย / รูดบัตร
              </button>
              <button
                type="button"
                className={`mode-btn ${txType === 'income' ? 'active' : ''}`}
                style={{ flex: 1, justifyContent: 'center' }}
                onClick={() => {
                  setTxType('income');
                  setTxCategory('salary');
                }}
              >
                💰 รายรับ
              </button>
              <button
                type="button"
                className={`mode-btn ${txType === 'transfer' ? 'active' : ''}`}
                style={{ flex: 1, justifyContent: 'center' }}
                onClick={() => setTxType('transfer')}
              >
                🔄 โอน/จ่ายบัตร
              </button>
            </div>

            <form onSubmit={handleAddTransaction}>
              <div className="form-group">
                <label className="form-label">จำนวนเงิน (บาท)</label>
                <input
                  type="number"
                  step="0.01"
                  className="form-input"
                  placeholder="0.00"
                  value={txAmount}
                  onChange={(e) => setTxAmount(e.target.value)}
                  required
                  autoFocus
                />
              </div>

              <div className="form-group">
                <label className="form-label">
                  {txType === 'income'
                    ? 'รับเงินเข้าบัญชีไหน'
                    : txType === 'transfer'
                    ? 'โอนออกจากบัญชีไหน'
                    : 'จ่ายด้วยบัญชีไหน หรือ รูดบัตรเครดิตใบไหน'}
                </label>
                <select
                  className="form-select"
                  value={txAccountId}
                  onChange={(e) => {
                    const id = e.target.value;
                    setTxAccountId(id);
                    const acc = appState.accounts.find((a) => a.id === id);
                    if (acc) setTxShared(Boolean(acc.isSharedWithFamily));
                  }}
                >
                  {visibleAccounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {ACCOUNT_TYPE_META[a.type]?.icon} {a.name} ({a.ownerName})
                    </option>
                  ))}
                </select>
              </div>

              {txType === 'transfer' && (
                <div className="form-group">
                  <label className="form-label">โอนเข้าบัญชี / จ่ายบิลบัตรใบไหน</label>
                  <select
                    className="form-select"
                    value={txToAccountId}
                    onChange={(e) => setTxToAccountId(e.target.value)}
                  >
                    {visibleAccounts
                      .filter((a) => a.id !== txAccountId)
                      .map((a) => (
                        <option key={a.id} value={a.id}>
                          {ACCOUNT_TYPE_META[a.type]?.icon} {a.name}
                        </option>
                      ))}
                  </select>
                </div>
              )}

              {txType !== 'transfer' && (
                <div className="form-group">
                  <label className="form-label">หมวดหมู่</label>
                  <select
                    className="form-select"
                    value={txCategory}
                    onChange={(e) => setTxCategory(e.target.value)}
                  >
                    {(txType === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES).map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.icon} {c.label}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* If paying with Credit Card or BNPL, allow choosing Installment! */}
              {txType === 'expense' &&
                ACCOUNT_TYPE_META[appState.accounts.find((a) => a.id === txAccountId)?.type]
                  ?.isLiability && (
                  <div
                    style={{
                      padding: 12,
                      borderRadius: 12,
                      background: '#eef2ff',
                      border: '1px solid #c7d2fe',
                      marginBottom: 14,
                    }}
                  >
                    <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 700, fontSize: '0.88rem', cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={txIsInstallment}
                        onChange={(e) => setTxIsInstallment(e.target.checked)}
                      />
                      💳 รูดแบบผ่อนชำระรายเดือน (Installment 0%)
                    </label>
                    {txIsInstallment && (
                      <div style={{ marginTop: 10 }}>
                        <label className="form-label">จำนวนเดือนที่ผ่อน</label>
                        <select
                          className="form-select"
                          value={txInstallmentMonths}
                          onChange={(e) => setTxInstallmentMonths(e.target.value)}
                        >
                          <option value="3">ผ่อน 3 เดือน</option>
                          <option value="4">ผ่อน 4 เดือน</option>
                          <option value="6">ผ่อน 6 เดือน</option>
                          <option value="10">ผ่อน 10 เดือน</option>
                          <option value="12">ผ่อน 12 เดือน</option>
                          <option value="24">ผ่อน 24 เดือน</option>
                        </select>
                      </div>
                    )}
                  </div>
                )}

              <div className="form-group">
                <label className="form-label">รายละเอียด / บันทึกช่วยจำ</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="เช่น ข้าวมันไก่, ค่าน้ำมัน, ซื้อของเข้าบ้าน"
                  value={txNote}
                  onChange={(e) => setTxNote(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label className="form-label">วันที่</label>
                <input
                  type="date"
                  className="form-input"
                  value={txDate}
                  onChange={(e) => setTxDate(e.target.value)}
                />
              </div>

              <div style={{ marginBottom: 18 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.88rem', fontWeight: 600, cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={txShared}
                    onChange={(e) => setTxShared(e.target.checked)}
                  />
                  🏠 แชร์รายการนี้ให้คนในบ้านเห็นในยอดรวมบ้านด้วย
                </label>
              </div>

              <button type="submit" className="btn btn-primary" style={{ width: '100%' }}>
                ✅ บันทึกรายการ
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* MODAL 2: สร้างบัญชีใหม่ / บัตรเครดิต / ใช้ก่อนจ่ายทีหลัง (BNPL) */}
      {/* ===================================================================== */}
      {showAccountModal && (
        <div className="modal-backdrop" onClick={() => setShowAccountModal(false)}>
          <div className="modal-panel" onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ fontSize: '1.15rem', fontWeight: 800 }}>
                💳 เพิ่มบัญชีใหม่ / บัตรเครดิต / PayLater
              </h3>
              <button type="button" onClick={() => setShowAccountModal(false)} className="btn btn-ghost btn-sm">
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateAccount}>
              <div className="form-group">
                <label className="form-label">ประเภทบัญชี</label>
                <select
                  className="form-select"
                  value={accType}
                  onChange={(e) => setAccType(e.target.value)}
                >
                  <option value="bank">🏦 บัญชีธนาคาร (สินทรัพย์)</option>
                  <option value="cash">💵 เงินสด (สินทรัพย์)</option>
                  <option value="ewallet">📱 E-Wallet เช่น TrueMoney (สินทรัพย์)</option>
                  <option value="credit_card">💳 บัตรเครดิต (ใช้ก่อน จ่ายทีหลัง)</option>
                  <option value="bnpl">⚡ สินเชื่อ PayLater เช่น SPayLater (ใช้ก่อน จ่ายทีหลัง)</option>
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">ชื่อบัญชี หรือ ชื่อบัตรเครดิต</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="เช่น กสิกรไทย, บัตร KTC, SPayLater"
                  value={accName}
                  onChange={(e) => setAccName(e.target.value)}
                  required
                />
              </div>

              {!ACCOUNT_TYPE_META[accType]?.isLiability ? (
                <div className="form-group">
                  <label className="form-label">ยอดเงินคงเหลือตั้งต้น (บาท)</label>
                  <input
                    type="number"
                    step="0.01"
                    className="form-input"
                    placeholder="0.00"
                    value={accBalance}
                    onChange={(e) => setAccBalance(e.target.value)}
                  />
                </div>
              ) : (
                <>
                  <div className="grid-2">
                    <div className="form-group">
                      <label className="form-label">วงเงินบัตรทั้งหมด (บาท)</label>
                      <input
                        type="number"
                        step="0.01"
                        className="form-input"
                        value={accCreditLimit}
                        onChange={(e) => setAccCreditLimit(e.target.value)}
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label">ยอดรูดใช้ไปแล้วตอนนี้ (บาท)</label>
                      <input
                        type="number"
                        step="0.01"
                        className="form-input"
                        value={accUsedAmount}
                        onChange={(e) => setAccUsedAmount(e.target.value)}
                      />
                    </div>
                  </div>
                  <div className="grid-2">
                    <div className="form-group">
                      <label className="form-label">วันสรุปยอดบิล (ของทุกเดือน)</label>
                      <input
                        type="number"
                        min="1"
                        max="31"
                        className="form-input"
                        value={accStatementDay}
                        onChange={(e) => setAccStatementDay(e.target.value)}
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label">วันครบกำหนดชำระ</label>
                      <input
                        type="number"
                        min="1"
                        max="31"
                        className="form-input"
                        value={accDueDay}
                        onChange={(e) => setAccDueDay(e.target.value)}
                      />
                    </div>
                  </div>
                </>
              )}

              <div style={{ marginBottom: 18 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.88rem', fontWeight: 600, cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={accShared}
                    onChange={(e) => setAccShared(e.target.checked)}
                  />
                  🏠 แชร์บัญชี/บัตรใบนี้ให้คนในบ้านเห็นยอดรวมด้วย
                </label>
              </div>

              <button type="submit" className="btn btn-primary" style={{ width: '100%' }}>
                ＋ สร้างบัญชี / บัตร
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* MODAL 3: จ่ายบิลบัตรเครดิต / โปะยอด PayLater */}
      {/* ===================================================================== */}
      {showPayCardModal && (
        <div className="modal-backdrop" onClick={() => setShowPayCardModal(null)}>
          <div className="modal-panel" onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <h3 style={{ fontSize: '1.15rem', fontWeight: 800 }}>
                💳 จ่ายบิล: {showPayCardModal.name}
              </h3>
              <button type="button" onClick={() => setShowPayCardModal(null)} className="btn btn-ghost btn-sm">
                ✕
              </button>
            </div>

            <p style={{ fontSize: '0.84rem', color: '#64748b', marginBottom: 14 }}>
              ระบบจะหักเงินจากบัญชีธนาคารที่คุณเลือก ไปลดยอดหนี้ค้างชำระของบัตรเครดิตและคืนวงเงินให้ทันที (โดยไม่นับเป็นรายจ่ายซ้ำ)
            </p>

            <form onSubmit={handlePayCreditCardBill}>
              <div className="form-group">
                <label className="form-label">ตัดเงินจากบัญชีธนาคาร / เงินสดใบไหน</label>
                <select
                  className="form-select"
                  value={payCardFromAccId}
                  onChange={(e) => setPayCardFromAccId(e.target.value)}
                  required
                >
                  {assetAccounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name} (คงเหลือ {formatTHB(a.balance)})
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">
                  จำนวนเงินที่ต้องการจ่าย (ยอดค้างปัจจุบัน: {formatTHB(showPayCardModal.usedAmount)})
                </label>
                <input
                  type="number"
                  step="0.01"
                  className="form-input"
                  value={payCardAmount}
                  onChange={(e) => setPayCardAmount(e.target.value)}
                  required
                />
              </div>

              <button type="submit" className="btn btn-primary" style={{ width: '100%' }}>
                ✅ ยืนยันการจ่ายบิลบัตรเครดิต
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* MODAL 4: เพิ่มรายการผ่อนชำระ (Installment Plan) */}
      {/* ===================================================================== */}
      {showInstallmentModal && (
        <div className="modal-backdrop" onClick={() => setShowInstallmentModal(false)}>
          <div className="modal-panel" onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <h3 style={{ fontSize: '1.15rem', fontWeight: 800 }}>📅 เพิ่มรายการผ่อนสินค้า (0% / ผ่อนบัตร)</h3>
              <button type="button" onClick={() => setShowInstallmentModal(false)} className="btn btn-ghost btn-sm">
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateInstallment}>
              <div className="form-group">
                <label className="form-label">ชื่อสินค้า / รายการที่ผ่อน</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="เช่น ผ่อนตู้เย็น, ผ่อน iPhone 16 (0% 10 เดือน)"
                  value={instTitle}
                  onChange={(e) => setInstTitle(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">รูดผ่อนผ่านบัตรเครดิต / PayLater ใบไหน</label>
                <select
                  className="form-select"
                  value={instAccountId || creditAccounts[0]?.id || ''}
                  onChange={(e) => setInstAccountId(e.target.value)}
                  required
                >
                  {creditAccounts.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid-2">
                <div className="form-group">
                  <label className="form-label">ราคารวมทั้งหมด (บาท)</label>
                  <input
                    type="number"
                    step="0.01"
                    className="form-input"
                    placeholder="10000"
                    value={instTotalAmount}
                    onChange={(e) => setInstTotalAmount(e.target.value)}
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">จำนวนงวด (เดือน)</label>
                  <select
                    className="form-select"
                    value={instMonths}
                    onChange={(e) => setInstMonths(e.target.value)}
                  >
                    <option value="3">3 เดือน</option>
                    <option value="6">6 เดือน</option>
                    <option value="10">10 เดือน</option>
                    <option value="12">12 เดือน</option>
                    <option value="24">24 เดือน</option>
                  </select>
                </div>
              </div>

              <div style={{ marginBottom: 16 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.88rem', fontWeight: 600 }}>
                  <input
                    type="checkbox"
                    checked={instShared}
                    onChange={(e) => setInstShared(e.target.checked)}
                  />
                  🏠 แชร์รายการผ่อนนี้ให้คนในบ้านเห็นด้วย
                </label>
              </div>

              <button
                type="submit"
                onClick={() => {
                  if (!instAccountId && creditAccounts[0]) {
                    setInstAccountId(creditAccounts[0].id);
                  }
                }}
                className="btn btn-primary"
                style={{ width: '100%' }}
              >
                ＋ บันทึกรายการผ่อนชำระ
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* MODAL 5: สร้างการยืมเงิน / ให้คนอื่นยืมเงิน */}
      {/* ===================================================================== */}
      {showLoanModal && (
        <div className="modal-backdrop" onClick={() => setShowLoanModal(false)}>
          <div className="modal-panel" onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <h3 style={{ fontSize: '1.15rem', fontWeight: 800 }}>🤝 สร้างรายการยืมเงิน / ให้ยืมเงิน</h3>
              <button type="button" onClick={() => setShowLoanModal(false)} className="btn btn-ghost btn-sm">
                ✕
              </button>
            </div>

            <div className="mode-switcher" style={{ width: '100%', marginBottom: 16 }}>
              <button
                type="button"
                className={`mode-btn ${loanType === 'lend' ? 'active' : ''}`}
                style={{ flex: 1, justifyContent: 'center' }}
                onClick={() => setLoanType('lend')}
              >
                🟢 เราให้คนอื่นยืม (ลูกหนี้)
              </button>
              <button
                type="button"
                className={`mode-btn ${loanType === 'borrow' ? 'active' : ''}`}
                style={{ flex: 1, justifyContent: 'center' }}
                onClick={() => setLoanType('borrow')}
              >
                🟠 เรายืมคนอื่นมา (เจ้าหนี้)
              </button>
            </div>

            <form onSubmit={handleCreateLoan}>
              <div className="form-group">
                <label className="form-label">
                  {loanType === 'lend' ? 'ชื่อคนที่มายืมเงินเรา' : 'ชื่อคนที่เรายืมเงินมา'}
                </label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="เช่น บอย, น้องสาว, คุณแม่"
                  value={loanPerson}
                  onChange={(e) => setLoanPerson(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">จำนวนเงิน (บาท)</label>
                <input
                  type="number"
                  step="0.01"
                  className="form-input"
                  placeholder="0.00"
                  value={loanAmount}
                  onChange={(e) => setLoanAmount(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">
                  {loanType === 'lend' ? 'โอนเงินให้ยืมจากบัญชีไหน' : 'รับเงินที่ยืมเข้าบัญชีไหน'}
                </label>
                <select
                  className="form-select"
                  value={loanAccountId}
                  onChange={(e) => setLoanAccountId(e.target.value)}
                >
                  {assetAccounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name} (คงเหลือ {formatTHB(a.balance)})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid-2">
                <div className="form-group">
                  <label className="form-label">วันนัดคืนเงิน</label>
                  <input
                    type="date"
                    className="form-input"
                    value={loanDueDate}
                    onChange={(e) => setLoanDueDate(e.target.value)}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">หมายเหตุ</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="เช่น นัดคืนสิ้นเดือน"
                    value={loanNote}
                    onChange={(e) => setLoanNote(e.target.value)}
                  />
                </div>
              </div>

              <div style={{ marginBottom: 16 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.88rem', fontWeight: 600 }}>
                  <input
                    type="checkbox"
                    checked={loanShared}
                    onChange={(e) => setLoanShared(e.target.checked)}
                  />
                  🏠 แชร์รายการยืมนี้ให้คนในบ้านรับรู้ด้วย
                </label>
              </div>

              <button type="submit" className="btn btn-primary" style={{ width: '100%' }}>
                ✅ บันทึกรายการ
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* MODAL 6: รับเงินคืน / จ่ายคืนหนี้ (ทยอยคืน หรือ คืนเต็มจำนวน) */}
      {/* ===================================================================== */}
      {showRepayLoanModal && (
        <div className="modal-backdrop" onClick={() => setShowRepayLoanModal(null)}>
          <div className="modal-panel" onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <h3 style={{ fontSize: '1.15rem', fontWeight: 800 }}>
                {showRepayLoanModal.loanType === 'lend'
                  ? `🟢 รับเงินคืนจาก: ${showRepayLoanModal.personName}`
                  : `🟠 จ่ายคืนหนี้ให้: ${showRepayLoanModal.personName}`}
              </h3>
              <button type="button" onClick={() => setShowRepayLoanModal(null)} className="btn btn-ghost btn-sm">
                ✕
              </button>
            </div>

            <form onSubmit={handleRecordLoanRepayment}>
              <div className="form-group">
                <label className="form-label">
                  จำนวนเงินที่คืนรอบนี้ (ยอดคงเหลือ:{' '}
                  {formatTHB(showRepayLoanModal.totalAmount - showRepayLoanModal.paidAmount)})
                </label>
                <input
                  type="number"
                  step="0.01"
                  className="form-input"
                  value={repayAmount}
                  onChange={(e) => setRepayAmount(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">
                  {showRepayLoanModal.loanType === 'lend'
                    ? 'รับเงินเข้าบัญชีธนาคารไหน'
                    : 'ตัดเงินจ่ายคืนจากบัญชีไหน'}
                </label>
                <select
                  className="form-select"
                  value={repayAccountId}
                  onChange={(e) => setRepayAccountId(e.target.value)}
                >
                  {assetAccounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name} (คงเหลือ {formatTHB(a.balance)})
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">บันทึกเพิ่มเติม</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="เช่น โอนคืนงวดที่ 2"
                  value={repayNote}
                  onChange={(e) => setRepayNote(e.target.value)}
                />
              </div>

              <button type="submit" className="btn btn-success" style={{ width: '100%' }}>
                ✅ บันทึกยอดชำระ
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
