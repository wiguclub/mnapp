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
  decodeJwtPayload,
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

  // Google Sign-In State
  const [showGoogleEmailStep, setShowGoogleEmailStep] = useState(false);
  const [customGmail, setCustomGmail] = useState('');
  const [customName, setCustomName] = useState('');
  const [loginError, setLoginError] = useState('');

  // Modals State (Create & Edit)
  const [showTxModal, setShowTxModal] = useState(false);
  const [editingTx, setEditingTx] = useState(null); // null = create, object = edit

  const [showAccountModal, setShowAccountModal] = useState(false);
  const [editingAccount, setEditingAccount] = useState(null); // null = create, object = edit

  const [showPayCardModal, setShowPayCardModal] = useState(null);

  const [showInstallmentModal, setShowInstallmentModal] = useState(false);
  const [editingInstallment, setEditingInstallment] = useState(null); // null = create, object = edit

  const [showLoanModal, setShowLoanModal] = useState(false);
  const [editingLoan, setEditingLoan] = useState(null); // null = create, object = edit

  const [showRepayLoanModal, setShowRepayLoanModal] = useState(null);
  const [showEditProfileModal, setShowEditProfileModal] = useState(false);
  const [profileNameInput, setProfileNameInput] = useState('');
  const [familyNameEditInput, setFamilyNameEditInput] = useState('');

  const [toastMessage, setToastMessage] = useState('');

  // Transaction Form State
  const [txType, setTxType] = useState('expense');
  const [txAmount, setTxAmount] = useState('');
  const [txCategory, setTxCategory] = useState('food');
  const [txAccountId, setTxAccountId] = useState('');
  const [txToAccountId, setTxToAccountId] = useState('');
  const [txNote, setTxNote] = useState('');
  const [txDate, setTxDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [txIsInstallment, setTxIsInstallment] = useState(false);
  const [txInstallmentMonths, setTxInstallmentMonths] = useState('6');
  const [txShared, setTxShared] = useState(false);

  // Account / Card Form State
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

  // Installment Form State
  const [instTitle, setInstTitle] = useState('');
  const [instAccountId, setInstAccountId] = useState('');
  const [instTotalAmount, setInstTotalAmount] = useState('');
  const [instMonths, setInstMonths] = useState('10');
  const [instPaidMonths, setInstPaidMonths] = useState('0');
  const [instShared, setInstShared] = useState(false);

  // Loan Form State
  const [loanType, setLoanType] = useState('lend');
  const [loanPerson, setLoanPerson] = useState('');
  const [loanAmount, setLoanAmount] = useState('');
  const [loanPaidAmount, setLoanPaidAmount] = useState('0');
  const [loanAccountId, setLoanAccountId] = useState('');
  const [loanDueDate, setLoanDueDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [loanNote, setLoanNote] = useState('');
  const [loanShared, setLoanShared] = useState(false);

  // Repay Loan Form State
  const [repayAmount, setRepayAmount] = useState('');
  const [repayAccountId, setRepayAccountId] = useState('');
  const [repayNote, setRepayNote] = useState('');

  // Family Form State
  const [inviteEmailInput, setInviteEmailInput] = useState('');
  const [joinCodeInput, setJoinCodeInput] = useState('');
  const [newFamilyName, setNewFamilyName] = useState('');

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

  const completeUserSession = (stateSnapshot, email, name, pictureUrl) => {
    const cleanEmail = (email || '').trim().toLowerCase();
    if (!cleanEmail) return;

    const existingUser = stateSnapshot.users.find(
      (u) => u.email.toLowerCase() === cleanEmail
    );
    if (existingUser) {
      setCurrentUser(existingUser);
      saveCurrentUser(existingUser);
      return;
    }

    const fallbackName = cleanEmail.split('@')[0];
    const displayName = (name || fallbackName).trim();
    const joinedFamily = stateSnapshot.familyGroups.find((fg) =>
      fg.memberEmails.includes(cleanEmail)
    );

    const newUser = {
      email: cleanEmail,
      name: displayName,
      avatar: pictureUrl || displayName.slice(0, 1).toUpperCase(),
      familyId: joinedFamily ? joinedFamily.id : null,
    };

    const today = new Date().toISOString().slice(0, 10);
    const starterCashAcc = {
      id: `acc-${Date.now()}`,
      ownerEmail: cleanEmail,
      ownerName: displayName,
      familyId: newUser.familyId,
      isSharedWithFamily: false,
      name: 'กระเป๋าเงินสด',
      type: 'cash',
      balance: 0,
      creditLimit: 0,
      usedAmount: 0,
      statementDay: 1,
      dueDay: 1,
      color: '#059669',
      createdAt: today,
    };

    const nextState = {
      ...stateSnapshot,
      users: [...stateSnapshot.users, newUser],
      accounts: [...stateSnapshot.accounts, starterCashAcc],
    };
    saveAppState(nextState);
    setAppState(nextState);
    setCurrentUser(newUser);
    saveCurrentUser(newUser);
  };

  useEffect(() => {
    const loadedState = loadAppState();
    setAppState(loadedState);

    if (typeof window !== 'undefined' && window.location.hash) {
      const hashParams = new URLSearchParams(window.location.hash.substring(1));
      const idToken = hashParams.get('id_token') || hashParams.get('access_token');
      if (idToken) {
        const payload = decodeJwtPayload(idToken);
        if (payload && payload.email) {
          const fullName =
            payload.name ||
            payload.user_metadata?.full_name ||
            payload.email.split('@')[0];
          const avatarUrl =
            payload.picture || payload.user_metadata?.avatar_url || '';
          completeUserSession(loadedState, payload.email, fullName, avatarUrl);
          window.history.replaceState(null, '', window.location.pathname);
          setHydrated(true);
          return;
        }
      }
    }

    const savedUser = loadCurrentUser();
    if (savedUser && savedUser.email) {
      completeUserSession(loadedState, savedUser.email, savedUser.name, savedUser.avatar);
    }

    setHydrated(true);
  }, []);

  // Load Google Identity Services
  const googleClientId =
    process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ||
    '200977643476-bpmib6emq7n3c870i8430keqjh929j0q.apps.googleusercontent.com';

  useEffect(() => {
    if (!hydrated || currentUser || typeof window === 'undefined') return;
    if (!googleClientId) return;

    const existingScript = document.getElementById('google-gsi-script');
    const initGsi = () => {
      if (window.google?.accounts?.id) {
        window.google.accounts.id.initialize({
          client_id: googleClientId,
          callback: (response) => {
            const payload = decodeJwtPayload(response.credential);
            if (payload && payload.email) {
              const latestState = loadAppState();
              completeUserSession(
                latestState,
                payload.email,
                payload.name || payload.email.split('@')[0],
                payload.picture
              );
              showToast(`เข้าสู่ระบบด้วย ${payload.email} สำเร็จ`);
            }
          },
          auto_select: true,
        });
        const btnContainer = document.getElementById('google-official-btn');
        if (btnContainer) {
          btnContainer.innerHTML = '';
          window.google.accounts.id.renderButton(btnContainer, {
            theme: 'filled_blue',
            size: 'large',
            width: 340,
            text: 'continue_with',
            shape: 'pill',
          });
        }
        window.google.accounts.id.prompt();
      }
    };

    if (existingScript && window.google?.accounts?.id) {
      initGsi();
      return;
    }

    if (!existingScript) {
      const script = document.createElement('script');
      script.id = 'google-gsi-script';
      script.src = 'https://accounts.google.com/gsi/client';
      script.async = true;
      script.defer = true;
      script.onload = initGsi;
      document.body.appendChild(script);
    }
  }, [hydrated, currentUser, googleClientId]);

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

  const handleGoogleButtonClick = () => {
    if (isSupabaseConfigured()) {
      startSupabaseGoogleLogin();
      return;
    }
    if (typeof window !== 'undefined' && window.google?.accounts?.oauth2 && googleClientId) {
      const tokenClient = window.google.accounts.oauth2.initTokenClient({
        client_id: googleClientId,
        scope: 'openid email profile',
        callback: async (tokenResponse) => {
          if (tokenResponse && tokenResponse.access_token) {
            try {
              const res = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
                headers: { Authorization: `Bearer ${tokenResponse.access_token}` },
              });
              const profile = await res.json();
              if (profile && profile.email) {
                const latestState = loadAppState();
                completeUserSession(
                  latestState,
                  profile.email,
                  profile.name || profile.email.split('@')[0],
                  profile.picture || ''
                );
                showToast(`เข้าสู่ระบบด้วย ${profile.email} สำเร็จ`);
              }
            } catch {
              setShowGoogleEmailStep(true);
            }
          }
        },
      });
      tokenClient.requestAccessToken({ prompt: 'select_account' });
      return;
    }
    setShowGoogleEmailStep(true);
  };

  const handleLoginWithGmail = (e) => {
    e.preventDefault();
    let cleanEmail = (customGmail || '').trim().toLowerCase();
    if (!cleanEmail) {
      setLoginError('กรุณากรอกอีเมล Gmail ของคุณ');
      return;
    }
    if (!cleanEmail.includes('@')) {
      cleanEmail = `${cleanEmail}@gmail.com`;
    }
    setLoginError('');
    completeUserSession(appState, cleanEmail, customName || cleanEmail.split('@')[0], '');
    showToast(`เข้าสู่ระบบด้วย ${cleanEmail} สำเร็จ`);
  };

  const handleLogout = () => {
    setCurrentUser(null);
    saveCurrentUser(null);
    setShowGoogleEmailStep(false);
    setCustomGmail('');
    setCustomName('');
  };

  // ============================================================================
  // PROFILE & FAMILY NAME EDITING
  // ============================================================================
  const openEditProfileModal = () => {
    setProfileNameInput(currentUser?.name || '');
    setFamilyNameEditInput(currentFamily?.name || '');
    setShowEditProfileModal(true);
  };

  const handleSaveProfileAndFamily = (e) => {
    e.preventDefault();
    const newName = profileNameInput.trim() || currentUser.name;
    const newHouseName = familyNameEditInput.trim();

    updateState((prev) => ({
      ...prev,
      users: prev.users.map((u) =>
        u.email === currentUser.email ? { ...u, name: newName } : u
      ),
      accounts: prev.accounts.map((a) =>
        a.ownerEmail === currentUser.email ? { ...a, ownerName: newName } : a
      ),
      transactions: prev.transactions.map((t) =>
        t.ownerEmail === currentUser.email ? { ...t, ownerName: newName } : t
      ),
      installments: prev.installments.map((inst) =>
        inst.ownerEmail === currentUser.email ? { ...inst, ownerName: newName } : inst
      ),
      loans: prev.loans.map((l) =>
        l.ownerEmail === currentUser.email ? { ...l, ownerName: newName } : l
      ),
      familyGroups: prev.familyGroups.map((fg) =>
        currentFamily && fg.id === currentFamily.id && newHouseName
          ? { ...fg, name: newHouseName }
          : fg
      ),
    }));

    const updatedUser = { ...currentUser, name: newName };
    setCurrentUser(updatedUser);
    saveCurrentUser(updatedUser);
    setShowEditProfileModal(false);
    showToast('บันทึกข้อมูลชื่อเรียบร้อยแล้ว');
  };

  // ============================================================================
  // TRANSACTIONS: CREATE, EDIT, DELETE
  // ============================================================================
  const openNewTransactionModal = (defaultType = 'expense') => {
    setEditingTx(null);
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
    setTxDate(new Date().toISOString().slice(0, 10));
    setShowTxModal(true);
  };

  const openEditTransactionModal = (tx) => {
    setEditingTx(tx);
    setTxType(tx.type === 'card_payment' ? 'transfer' : tx.type);
    setTxAmount(String(tx.amount));
    setTxCategory(tx.category || 'food');
    setTxAccountId(tx.accountId);
    setTxToAccountId(tx.toAccountId || '');
    setTxNote(tx.note || '');
    setTxDate(tx.txDate || new Date().toISOString().slice(0, 10));
    setTxShared(Boolean(tx.isSharedWithFamily));
    setTxIsInstallment(false);
    setShowTxModal(true);
  };

  // Helper to apply or reverse a transaction's balance effect on accounts
  const applyTxEffectToAccounts = (accountsList, tx, multiplier = 1) => {
    const amt = Number(tx.amount || 0) * multiplier;
    return accountsList.map((acc) => {
      if (tx.type === 'income' && acc.id === tx.accountId) {
        if (ACCOUNT_TYPE_META[acc.type]?.isLiability) {
          return { ...acc, usedAmount: Math.max(0, Number(acc.usedAmount) - amt) };
        }
        return { ...acc, balance: Number(acc.balance) + amt };
      }
      if (tx.type === 'expense' && acc.id === tx.accountId) {
        if (ACCOUNT_TYPE_META[acc.type]?.isLiability) {
          return { ...acc, usedAmount: Math.max(0, Number(acc.usedAmount) + amt) };
        }
        return { ...acc, balance: Number(acc.balance) - amt };
      }
      if (tx.type === 'transfer' || tx.type === 'card_payment') {
        if (acc.id === tx.accountId) {
          return { ...acc, balance: Number(acc.balance) - amt };
        }
        if (acc.id === tx.toAccountId) {
          if (ACCOUNT_TYPE_META[acc.type]?.isLiability) {
            return { ...acc, usedAmount: Math.max(0, Number(acc.usedAmount) - amt) };
          }
          return { ...acc, balance: Number(acc.balance) + amt };
        }
      }
      return acc;
    });
  };

  const handleSaveTransaction = (e) => {
    e.preventDefault();
    const amount = parseFloat(txAmount);
    if (!amount || amount <= 0 || !txAccountId) return;

    const selectedAcc = appState.accounts.find((a) => a.id === txAccountId);
    if (!selectedAcc) return;

    const isCreditOrBnpl = ACCOUNT_TYPE_META[selectedAcc.type]?.isLiability;
    const today = txDate || new Date().toISOString().slice(0, 10);

    updateState((prev) => {
      let workingAccounts = prev.accounts;
      // If editing an existing transaction, reverse its old effect first
      if (editingTx) {
        workingAccounts = applyTxEffectToAccounts(workingAccounts, editingTx, -1);
      }

      const resolvedType =
        txType === 'transfer' &&
        prev.accounts.find((a) => a.id === txToAccountId && ACCOUNT_TYPE_META[a.type]?.isLiability)
          ? 'card_payment'
          : txType;

      const updatedTxObj = {
        id: editingTx ? editingTx.id : `tx-${Date.now()}`,
        ownerEmail: editingTx ? editingTx.ownerEmail : currentUser.email,
        ownerName: editingTx ? editingTx.ownerName : currentUser.name,
        isSharedWithFamily: txShared,
        type: resolvedType,
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
        createdAt: editingTx ? editingTx.createdAt : today,
      };

      workingAccounts = applyTxEffectToAccounts(workingAccounts, updatedTxObj, 1);

      let updatedInstallments = prev.installments;
      if (!editingTx && txType === 'expense' && isCreditOrBnpl && txIsInstallment) {
        const months = Math.max(2, parseInt(txInstallmentMonths, 10) || 6);
        const newInst = {
          id: `inst-${Date.now()}`,
          accountId: txAccountId,
          ownerEmail: currentUser.email,
          ownerName: currentUser.name,
          isSharedWithFamily: txShared,
          title: `${updatedTxObj.note} (ผ่อน ${months} เดือน)`,
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

      const updatedTransactions = editingTx
        ? prev.transactions.map((t) => (t.id === editingTx.id ? updatedTxObj : t))
        : [updatedTxObj, ...prev.transactions];

      return {
        ...prev,
        accounts: workingAccounts,
        installments: updatedInstallments,
        transactions: updatedTransactions,
      };
    });

    setShowTxModal(false);
    setEditingTx(null);
    showToast(editingTx ? 'แก้ไขรายการเรียบร้อยแล้ว' : 'บันทึกรายการเรียบร้อยแล้ว');
  };

  const handleDeleteTransaction = (txToDelete) => {
    updateState((prev) => ({
      ...prev,
      accounts: applyTxEffectToAccounts(prev.accounts, txToDelete, -1),
      transactions: prev.transactions.filter((t) => t.id !== txToDelete.id),
    }));
    setShowTxModal(false);
    setEditingTx(null);
    showToast('ลบรายการและคืนยอดเงินเรียบร้อยแล้ว');
  };

  // ============================================================================
  // ACCOUNTS & CREDIT CARDS: CREATE, EDIT, DELETE
  // ============================================================================
  const openCreateAccountModal = (defaultType = 'bank') => {
    setEditingAccount(null);
    setAccType(defaultType);
    setAccName('');
    setAccBalance('');
    setAccCreditLimit('50000');
    setAccUsedAmount('0');
    setAccStatementDay('25');
    setAccDueDay('10');
    setAccColor(defaultType === 'credit_card' ? '#1e293b' : '#059669');
    setAccShared(false);
    setShowAccountModal(true);
  };

  const openEditAccountModal = (acc) => {
    setEditingAccount(acc);
    setAccType(acc.type);
    setAccName(acc.name);
    setAccBalance(String(acc.balance || 0));
    setAccCreditLimit(String(acc.creditLimit || 50000));
    setAccUsedAmount(String(acc.usedAmount || 0));
    setAccStatementDay(String(acc.statementDay || 25));
    setAccDueDay(String(acc.dueDay || 10));
    setAccColor(acc.color || '#4f46e5');
    setAccShared(Boolean(acc.isSharedWithFamily));
    setShowAccountModal(true);
  };

  const handleSaveAccount = (e) => {
    e.preventDefault();
    if (!accName.trim()) return;
    const isLiability = ACCOUNT_TYPE_META[accType]?.isLiability;
    const today = new Date().toISOString().slice(0, 10);

    if (editingAccount) {
      updateState((prev) => ({
        ...prev,
        accounts: prev.accounts.map((a) =>
          a.id === editingAccount.id
            ? {
                ...a,
                name: accName.trim(),
                type: accType,
                balance: isLiability ? 0 : parseFloat(accBalance) || 0,
                creditLimit: isLiability ? parseFloat(accCreditLimit) || 0 : 0,
                usedAmount: isLiability ? parseFloat(accUsedAmount) || 0 : 0,
                statementDay: parseInt(accStatementDay, 10) || 25,
                dueDay: parseInt(accDueDay, 10) || 10,
                color: accColor,
                isSharedWithFamily: accShared,
              }
            : a
        ),
      }));
      setShowAccountModal(false);
      setEditingAccount(null);
      showToast(`บันทึกการแก้ไข "${accName.trim()}" เรียบร้อยแล้ว`);
      return;
    }

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

  const handleDeleteAccount = (accToDelete) => {
    updateState((prev) => ({
      ...prev,
      accounts: prev.accounts.filter((a) => a.id !== accToDelete.id),
      installments: prev.installments.filter((i) => i.accountId !== accToDelete.id),
      transactions: prev.transactions.filter((t) => t.accountId !== accToDelete.id),
    }));
    setShowAccountModal(false);
    setEditingAccount(null);
    showToast(`ลบบัญชี "${accToDelete.name}" เรียบร้อยแล้ว`);
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

  // ============================================================================
  // INSTALLMENTS: CREATE, EDIT, DELETE
  // ============================================================================
  const openCreateInstallmentModal = () => {
    setEditingInstallment(null);
    setInstTitle('');
    setInstAccountId(creditAccounts[0]?.id || '');
    setInstTotalAmount('');
    setInstMonths('10');
    setInstPaidMonths('0');
    setInstShared(false);
    setShowInstallmentModal(true);
  };

  const openEditInstallmentModal = (inst) => {
    setEditingInstallment(inst);
    setInstTitle(inst.title);
    setInstAccountId(inst.accountId);
    setInstTotalAmount(String(inst.totalAmount));
    setInstMonths(String(inst.totalMonths));
    setInstPaidMonths(String(inst.paidMonths || 0));
    setInstShared(Boolean(inst.isSharedWithFamily));
    setShowInstallmentModal(true);
  };

  const handleSaveInstallment = (e) => {
    e.preventDefault();
    const total = parseFloat(instTotalAmount);
    const months = Math.max(1, parseInt(instMonths, 10) || 10);
    const paid = Math.min(months, Math.max(0, parseInt(instPaidMonths, 10) || 0));
    const targetAccId = instAccountId || creditAccounts[0]?.id;
    if (!instTitle.trim() || !total || total <= 0 || !targetAccId) return;

    const today = new Date().toISOString().slice(0, 10);
    const monthly = Math.round((total / months) * 100) / 100;

    if (editingInstallment) {
      updateState((prev) => ({
        ...prev,
        installments: prev.installments.map((item) =>
          item.id === editingInstallment.id
            ? {
                ...item,
                title: instTitle.trim(),
                accountId: targetAccId,
                totalAmount: total,
                totalMonths: months,
                paidMonths: paid,
                monthlyAmount: monthly,
                isSharedWithFamily: instShared,
              }
            : item
        ),
      }));
      setShowInstallmentModal(false);
      setEditingInstallment(null);
      showToast('บันทึกการแก้ไขรายการผ่อนชำระแล้ว');
      return;
    }

    updateState((prev) => ({
      ...prev,
      accounts: prev.accounts.map((a) =>
        a.id === targetAccId ? { ...a, usedAmount: Number(a.usedAmount) + total } : a
      ),
      installments: [
        {
          id: `inst-${Date.now()}`,
          accountId: targetAccId,
          ownerEmail: currentUser.email,
          ownerName: currentUser.name,
          isSharedWithFamily: instShared,
          title: instTitle.trim(),
          totalAmount: total,
          totalMonths: months,
          paidMonths: paid,
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

  const handleDeleteInstallment = (instToDelete) => {
    updateState((prev) => ({
      ...prev,
      installments: prev.installments.filter((i) => i.id !== instToDelete.id),
    }));
    setShowInstallmentModal(false);
    setEditingInstallment(null);
    showToast('ลบรายการผ่อนชำระแล้ว');
  };

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

  // ============================================================================
  // LOANS: CREATE, EDIT, DELETE, REPAY
  // ============================================================================
  const openCreateLoanModal = () => {
    setEditingLoan(null);
    setLoanType('lend');
    setLoanPerson('');
    setLoanAmount('');
    setLoanPaidAmount('0');
    setLoanAccountId(assetAccounts[0]?.id || '');
    setLoanDueDate(new Date().toISOString().slice(0, 10));
    setLoanNote('');
    setLoanShared(false);
    setShowLoanModal(true);
  };

  const openEditLoanModal = (loan) => {
    setEditingLoan(loan);
    setLoanType(loan.loanType);
    setLoanPerson(loan.personName);
    setLoanAmount(String(loan.totalAmount));
    setLoanPaidAmount(String(loan.paidAmount || 0));
    setLoanAccountId(loan.accountId || assetAccounts[0]?.id || '');
    setLoanDueDate(loan.dueDate || new Date().toISOString().slice(0, 10));
    setLoanNote(loan.note || '');
    setLoanShared(Boolean(loan.isSharedWithFamily));
    setShowLoanModal(true);
  };

  const handleSaveLoan = (e) => {
    e.preventDefault();
    const amount = parseFloat(loanAmount);
    const paid = Math.min(amount, Math.max(0, parseFloat(loanPaidAmount) || 0));
    if (!loanPerson.trim() || !amount || amount <= 0) return;

    const today = new Date().toISOString().slice(0, 10);

    if (editingLoan) {
      updateState((prev) => ({
        ...prev,
        loans: prev.loans.map((l) =>
          l.id === editingLoan.id
            ? {
                ...l,
                loanType,
                personName: loanPerson.trim(),
                totalAmount: amount,
                paidAmount: paid,
                accountId: loanAccountId,
                dueDate: loanDueDate || today,
                note: loanNote.trim(),
                isSharedWithFamily: loanShared,
                status: paid >= amount ? 'settled' : 'active',
              }
            : l
        ),
      }));
      setShowLoanModal(false);
      setEditingLoan(null);
      showToast(`บันทึกการแก้ไขรายการของ "${loanPerson.trim()}" แล้ว`);
      return;
    }

    const newLoan = {
      id: `loan-${Date.now()}`,
      ownerEmail: currentUser.email,
      ownerName: currentUser.name,
      isSharedWithFamily: loanShared,
      loanType,
      personName: loanPerson.trim(),
      totalAmount: amount,
      paidAmount: paid,
      accountId: loanAccountId,
      dueDate: loanDueDate || today,
      note: loanNote.trim() || (loanType === 'lend' ? 'ให้ยืมเงิน' : 'ยืมเงินมา'),
      status: paid >= amount ? 'settled' : 'active',
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

  const handleDeleteLoan = (loanToDelete) => {
    updateState((prev) => ({
      ...prev,
      loans: prev.loans.filter((l) => l.id !== loanToDelete.id),
    }));
    setShowLoanModal(false);
    setEditingLoan(null);
    showToast(`ลบรายการของ "${loanToDelete.personName}" แล้ว`);
  };

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

  const handleToggleAccountShare = (accountId) => {
    updateState((prev) => ({
      ...prev,
      accounts: prev.accounts.map((a) =>
        a.id === accountId ? { ...a, isSharedWithFamily: !a.isSharedWithFamily } : a
      ),
    }));
    showToast('อัปเดตสถานะการแชร์บัญชีกับคนในบ้านแล้ว');
  };

  const handleCreateFamilyGroup = (e) => {
    e.preventDefault();
    const houseName = (newFamilyName || `บ้านของ ${currentUser.name}`).trim();
    const randomCode = `HOME-${Math.floor(1000 + Math.random() * 9000)}`;
    const newGroup = {
      id: `fam-${Date.now()}`,
      name: houseName,
      inviteCode: randomCode,
      ownerEmail: currentUser.email,
      memberEmails: [currentUser.email],
      createdAt: new Date().toISOString().slice(0, 10),
    };

    updateState((prev) => ({
      ...prev,
      familyGroups: [...prev.familyGroups, newGroup],
      users: prev.users.map((u) =>
        u.email === currentUser.email ? { ...u, familyId: newGroup.id } : u
      ),
    }));
    setCurrentUser((prev) => {
      const updated = { ...prev, familyId: newGroup.id };
      saveCurrentUser(updated);
      return updated;
    });
    setNewFamilyName('');
    showToast(`สร้างบ้าน "${houseName}" รหัส ${randomCode} สำเร็จ!`);
  };

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

  const handleRemoveFamilyMember = (emailToRemove) => {
    if (!currentFamily) return;
    updateState((prev) => ({
      ...prev,
      familyGroups: prev.familyGroups.map((fg) =>
        fg.id === currentFamily.id
          ? { ...fg, memberEmails: fg.memberEmails.filter((em) => em !== emailToRemove) }
          : fg
      ),
    }));
    showToast(`นำ ${emailToRemove} ออกจากบ้านแล้ว`);
  };

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
    setCurrentUser((prev) => {
      const updated = { ...prev, familyId: found.id };
      saveCurrentUser(updated);
      return updated;
    });
    setJoinCodeInput('');
    showToast(`เข้าร่วม "${found.name}" สำเร็จ!`);
  };

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
  // 1. CLEAN GOOGLE SIGN-IN SCREEN
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
            maxWidth: 420,
            width: '100%',
            padding: 36,
            borderRadius: 24,
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
          }}
        >
          <div style={{ textAlign: 'center', marginBottom: 28 }}>
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
            <h1 style={{ fontSize: '1.6rem', fontWeight: 800, color: '#0f172a' }}>
              FlowWallet
            </h1>
            <p style={{ color: '#64748b', fontSize: '0.92rem', marginTop: 6 }}>
              แอปรายรับ-รายจ่าย หลายบัญชี • บัตรเครดิต & PayLater • ยืม/ให้ยืม • แชร์ยอดรวมกับคนในบ้าน
            </p>
          </div>

          {!showGoogleEmailStep ? (
            <div>
              {googleClientId && (
                <div
                  id="google-official-btn"
                  style={{
                    display: 'flex',
                    justifyContent: 'center',
                    marginBottom: 14,
                  }}
                />
              )}
              <button
                type="button"
                onClick={handleGoogleButtonClick}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 12,
                  padding: '14px 20px',
                  borderRadius: 14,
                  border: '1px solid #cbd5e1',
                  background: '#ffffff',
                  color: '#0f172a',
                  fontWeight: 700,
                  fontSize: '1rem',
                  cursor: 'pointer',
                  boxShadow: '0 2px 6px rgba(15, 23, 42, 0.06)',
                  transition: 'all 0.15s ease',
                }}
              >
                <svg width="22" height="22" viewBox="0 0 48 48">
                  <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
                  <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
                  <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
                  <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
                </svg>
                <span>ดำเนินการต่อด้วย Google (Gmail)</span>
              </button>

              <p style={{ textAlign: 'center', fontSize: '0.8rem', color: '#94a3b8', marginTop: 18 }}>
                ระบบจะจดจำการเข้าสู่ระบบของคุณบนอุปกรณ์นี้อัตโนมัติ แยกกระเป๋าตามบัญชี Gmail ของแต่ละคน
              </p>
            </div>
          ) : (
            <form onSubmit={handleLoginWithGmail}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18 }}>
                <svg width="24" height="24" viewBox="0 0 48 48">
                  <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
                  <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
                  <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
                  <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
                </svg>
                <div style={{ fontWeight: 700, fontSize: '1.02rem' }}>ลงชื่อเข้าใช้ด้วย Google</div>
              </div>

              <div className="form-group">
                <label className="form-label">อีเมล Gmail ของคุณ</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="yourname@gmail.com"
                  value={customGmail}
                  onChange={(e) => setCustomGmail(e.target.value)}
                  required
                  autoFocus
                />
              </div>

              <div className="form-group">
                <label className="form-label">ชื่อที่ใช้แสดง (เว้นว่างให้ใช้ชื่อจาก Gmail ได้)</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="เช่น นัท, เมย์"
                  value={customName}
                  onChange={(e) => setCustomName(e.target.value)}
                />
              </div>

              {loginError && (
                <div style={{ color: '#dc2626', fontSize: '0.85rem', marginBottom: 12 }}>
                  {loginError}
                </div>
              )}

              <div style={{ display: 'flex', gap: 8, marginTop: 18 }}>
                <button
                  type="button"
                  onClick={() => setShowGoogleEmailStep(false)}
                  className="btn btn-outline"
                >
                  ย้อนกลับ
                </button>
                <button type="submit" className="btn btn-primary" style={{ flex: 1 }}>
                  เข้าสู่ระบบอัตโนมัติ
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    );
  }

  // ============================================================================
  // 2. LOGGED-IN APP SHELL
  // ============================================================================
  return (
    <div className="app-shell">
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

        <div
          style={{
            background: 'rgba(255,255,255,0.06)',
            borderRadius: 14,
            padding: 14,
            marginTop: 'auto',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
            <span style={{ fontSize: '0.72rem', color: '#94a3b8' }}>บัญชี Google ปัจจุบัน:</span>
            <button
              type="button"
              onClick={openEditProfileModal}
              style={{
                background: 'transparent',
                border: 'none',
                color: '#a5b4fc',
                fontSize: '0.75rem',
                cursor: 'pointer',
                fontWeight: 600,
              }}
            >
              ✏️ แก้ไขชื่อ
            </button>
          </div>
          <div style={{ fontWeight: 700, fontSize: '0.92rem', color: '#fff' }}>
            {currentUser.name}
          </div>
          <div style={{ fontSize: '0.78rem', color: '#cbd5e1', marginBottom: 10, wordBreak: 'break-all' }}>
            {currentUser.email}
          </div>
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
            ออกจากระบบ
          </button>
        </div>
      </aside>

      {/* MAIN AREA */}
      <div className="main-area">
        <header className="top-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: '1.25rem' }}>
              {viewMode === 'family' ? '🏠' : '👤'}
            </span>
            <div>
              <div style={{ fontWeight: 800, fontSize: '1.02rem', display: 'flex', alignItems: 'center', gap: 6 }}>
                <span>
                  {viewMode === 'family'
                    ? currentFamily?.name || 'มุมมองคนในบ้าน'
                    : `กระเป๋าของ ${currentUser.name}`}
                </span>
                <button
                  type="button"
                  onClick={openEditProfileModal}
                  className="btn btn-ghost btn-sm"
                  style={{ padding: '2px 6px', fontSize: '0.76rem' }}
                  title="แก้ไขชื่อ"
                >
                  ✏️
                </button>
              </div>
              <div style={{ fontSize: '0.76rem', color: '#64748b' }}>
                {viewMode === 'family'
                  ? currentFamily
                    ? `รวมบัญชีที่แชร์ในบ้าน (${currentFamily.memberEmails.length} คน)`
                    : 'คุณยังไม่ได้สร้างหรือเข้าร่วมบ้าน (ไปที่แท็บ คนในบ้าน)'
                  : currentUser.email}
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
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
            >
              ออกจากระบบ
            </button>
          </div>
        </header>

        <main className="content-container">
          {/* ================================================================= */}
          {/* TAB 1: DASHBOARD */}
          {/* ================================================================= */}
          {activeTab === 'dashboard' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
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
                      onClick={() => openCreateAccountModal('bank')}
                      className="btn btn-sm"
                      style={{ background: 'rgba(255,255,255,0.16)', color: '#fff' }}
                    >
                      ＋ เพิ่มบัญชี/บัตร
                    </button>
                  </div>
                </div>

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

              <div className="grid-2">
                {/* Asset Wallets */}
                <div className="card">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                    <div>
                      <h2 style={{ fontSize: '1.05rem', fontWeight: 800 }}>🏦 บัญชีเงินสด & ธนาคาร</h2>
                      <p style={{ fontSize: '0.8rem', color: '#64748b' }}>กด ✏️ เพื่อแก้ไขชื่อหรือยอดเงินได้ทุกบัญชี</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => openCreateAccountModal('bank')}
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
                            <div style={{ fontWeight: 700, fontSize: '0.94rem', display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
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
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <div style={{ fontWeight: 800, fontSize: '1.02rem', color: '#059669' }}>
                            {formatTHB(acc.balance)}
                          </div>
                          <button
                            type="button"
                            onClick={() => openEditAccountModal(acc)}
                            className="btn btn-outline btn-sm"
                            style={{ padding: '4px 8px' }}
                            title="แก้ไขบัญชี"
                          >
                            ✏️
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Credit Cards & BNPL */}
                <div className="card">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                    <div>
                      <h2 style={{ fontSize: '1.05rem', fontWeight: 800 }}>💳 บัตรเครดิต & ใช้ก่อนจ่ายทีหลัง</h2>
                      <p style={{ fontSize: '0.8rem', color: '#64748b' }}>เช็กยอดรูด วงเงินคงเหลือ แก้ไขข้อมูล และจ่ายบิล</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => openCreateAccountModal('credit_card')}
                      className="btn btn-outline btn-sm"
                    >
                      ＋ เพิ่มบัตร/PayLater
                    </button>
                  </div>

                  {creditAccounts.length === 0 ? (
                    <div style={{ padding: 24, textAlign: 'center', color: '#64748b', fontSize: '0.88rem' }}>
                      ยังไม่มีบัตรเครดิตหรือสินเชื่อใช้ก่อนจ่ายทีหลัง กดปุ่ม <strong>&ldquo;＋ เพิ่มบัตร/PayLater&rdquo;</strong> ด้านบนเพื่อเพิ่มได้เลย
                    </div>
                  ) : (
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
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8, gap: 8 }}>
                              <div>
                                <div style={{ fontWeight: 700, fontSize: '0.95rem', display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
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
                              <div style={{ display: 'flex', gap: 6 }}>
                                <button
                                  type="button"
                                  onClick={() => openEditAccountModal(card)}
                                  className="btn btn-outline btn-sm"
                                  style={{ padding: '4px 8px' }}
                                  title="แก้ไขบัตร"
                                >
                                  ✏️
                                </button>
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
                  )}
                </div>
              </div>

              {/* Recent Transactions List */}
              <div className="card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                  <div>
                    <h2 style={{ fontSize: '1.05rem', fontWeight: 800 }}>📝 รายการเคลื่อนไหวล่าสุด</h2>
                    <p style={{ fontSize: '0.8rem', color: '#64748b' }}>
                      กดปุ่ม ✏️ ท้ายรายการเพื่อแก้ไขชื่อ ยอดเงิน หมวดหมู่ หรือลบรายการได้ตลอดเวลา
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
                    ยังไม่มีรายการบันทึก กดปุ่ม &ldquo;＋ เพิ่มรายการ&rdquo; เพื่อเริ่มต้นจดรายรับ-รายจ่ายได้เลย
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {visibleTransactions.slice(0, 20).map((tx) => {
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
                            gap: 10,
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
                                flexShrink: 0,
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

                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
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
                            <button
                              type="button"
                              onClick={() => openEditTransactionModal(tx)}
                              className="btn btn-outline btn-sm"
                              style={{ padding: '4px 8px' }}
                              title="แก้ไขหรือลบรายการนี้"
                            >
                              ✏️
                            </button>
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
          {/* TAB 2: ACCOUNTS, CREDIT CARDS & INSTALLMENTS */}
          {/* ================================================================= */}
          {activeTab === 'accounts' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
                <div>
                  <h1 style={{ fontSize: '1.35rem', fontWeight: 800 }}>
                    💳 จัดการบัญชีธนาคาร, บัตรเครดิต & ใช้ก่อนจ่ายทีหลัง
                  </h1>
                  <p style={{ fontSize: '0.86rem', color: '#64748b' }}>
                    กด ✏️ บนการ์ดเพื่อแก้ไขชื่อบัญชี วงเงิน วันสรุปยอด ยอดคงเหลือ หรือลบบัญชีได้ทันที
                  </p>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    type="button"
                    onClick={openCreateInstallmentModal}
                    className="btn btn-outline"
                  >
                    📅 + เพิ่มรายการผ่อนสินค้า
                  </button>
                  <button
                    type="button"
                    onClick={() => openCreateAccountModal('bank')}
                    className="btn btn-primary"
                  >
                    ＋ เพิ่มบัญชี / บัตรเครดิต
                  </button>
                </div>
              </div>

              <div>
                <h2 style={{ fontSize: '1.05rem', fontWeight: 800, marginBottom: 12 }}>
                  ⚡ บัตรเครดิต & สินเชื่อใช้ก่อนจ่ายทีหลัง (Credit Card / BNPL)
                </h2>
                {creditAccounts.length === 0 ? (
                  <div className="card" style={{ textAlign: 'center', color: '#64748b', padding: 28 }}>
                    ยังไม่มีบัตรเครดิต กดปุ่ม <strong>&ldquo;＋ เพิ่มบัญชี / บัตรเครดิต&rdquo;</strong> เพื่อสร้างบัตรใบแรกของคุณได้เลย
                  </div>
                ) : (
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
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 6 }}>
                              <span className="badge" style={{ background: 'rgba(255,255,255,0.2)', color: '#fff' }}>
                                {ACCOUNT_TYPE_META[card.type]?.badge}
                              </span>
                              <div style={{ display: 'flex', gap: 6 }}>
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
                                  {card.isSharedWithFamily ? '🏠 แชร์บ้าน' : '🔒 ส่วนตัว'}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => openEditAccountModal(card)}
                                  className="badge"
                                  style={{
                                    background: 'rgba(255,255,255,0.22)',
                                    color: '#fff',
                                    border: 'none',
                                    cursor: 'pointer',
                                  }}
                                >
                                  ✏️ แก้ไข
                                </button>
                              </div>
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
                )}
              </div>

              {/* Active Installments */}
              <div className="card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                  <div>
                    <h2 style={{ fontSize: '1.05rem', fontWeight: 800 }}>
                      📅 รายการผ่อนชำระรายเดือน (Installment Plans)
                    </h2>
                    <p style={{ fontSize: '0.8rem', color: '#64748b' }}>
                      ติดตามยอดผ่อน 0% หรือผ่อนของผ่านบัตรเครดิต/PayLater กด ✏️ เพื่อแก้ไขได้ทุกรายการ
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={openCreateInstallmentModal}
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
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8, gap: 8 }}>
                            <div>
                              <div style={{ fontWeight: 700, fontSize: '0.95rem' }}>{inst.title}</div>
                              <div style={{ fontSize: '0.78rem', color: '#64748b' }}>
                                บัตร: {card?.name || '-'} • ผ่อนเดือนละ{' '}
                                <strong style={{ color: '#4f46e5' }}>{formatTHB(inst.monthlyAmount)}</strong>
                              </div>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                              <span className="badge badge-indigo">
                                งวด {inst.paidMonths}/{inst.totalMonths}
                              </span>
                              <button
                                type="button"
                                onClick={() => openEditInstallmentModal(inst)}
                                className="btn btn-outline btn-sm"
                                style={{ padding: '3px 8px' }}
                              >
                                ✏️
                              </button>
                            </div>
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
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button
                            type="button"
                            onClick={() => handleToggleAccountShare(acc.id)}
                            className={`badge ${acc.isSharedWithFamily ? 'badge-pink' : 'badge-slate'}`}
                            style={{ border: 'none', cursor: 'pointer' }}
                          >
                            {acc.isSharedWithFamily ? '🏠 แชร์บ้าน' : '🔒 ส่วนตัว'}
                          </button>
                          <button
                            type="button"
                            onClick={() => openEditAccountModal(acc)}
                            className="badge badge-indigo"
                            style={{ border: 'none', cursor: 'pointer' }}
                          >
                            ✏️ แก้ไข
                          </button>
                        </div>
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
          {/* TAB 3: LOANS & DEBT TRACKING */}
          {/* ================================================================= */}
          {activeTab === 'loans' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
                <div>
                  <h1 style={{ fontSize: '1.35rem', fontWeight: 800 }}>
                    🤝 ระบบติดตามการยืมเงิน & ให้คนอื่นยืมเงิน
                  </h1>
                  <p style={{ fontSize: '0.86rem', color: '#64748b' }}>
                    กด ✏️ เพื่อแก้ไขชื่อผู้ยืม ยอดเงิน วันนัดคืน หรือลบรายการได้ตลอดเวลา
                  </p>
                </div>
                <button
                  type="button"
                  onClick={openCreateLoanModal}
                  className="btn btn-primary"
                >
                  ＋ สร้างรายการยืม / ให้ยืม
                </button>
              </div>

              <div className="grid-2">
                {/* LEND */}
                <div className="card">
                  <div style={{ marginBottom: 14 }}>
                    <h2 style={{ fontSize: '1.05rem', fontWeight: 800, color: '#065f46' }}>
                      🟢 ลูกหนี้ (เราให้คนอื่นยืม - รอรับคืน)
                    </h2>
                    <p style={{ fontSize: '0.8rem', color: '#64748b' }}>
                      ยอดรอรับคืนทั้งหมด: <strong>{formatTHB(summary.totalReceivableLoans)}</strong>
                    </p>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {visibleLoans.filter((l) => l.loanType === 'lend').length === 0 ? (
                      <div style={{ padding: 20, textAlign: 'center', color: '#64748b', fontSize: '0.86rem' }}>
                        ยังไม่มีรายการให้ยืมเงิน
                      </div>
                    ) : (
                      visibleLoans
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
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8, gap: 8 }}>
                                <div>
                                  <div style={{ fontWeight: 800, fontSize: '1rem', display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
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
                                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                                  <button
                                    type="button"
                                    onClick={() => openEditLoanModal(loan)}
                                    className="btn btn-outline btn-sm"
                                    style={{ padding: '4px 8px' }}
                                  >
                                    ✏️
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleCopyLoanLineMessage(loan)}
                                    className="btn btn-outline btn-sm"
                                  >
                                    📋 LINE
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
                            </div>
                          );
                        })
                    )}
                  </div>
                </div>

                {/* BORROW */}
                <div className="card">
                  <div style={{ marginBottom: 14 }}>
                    <h2 style={{ fontSize: '1.05rem', fontWeight: 800, color: '#92400e' }}>
                      🟠 เจ้าหนี้ (เรายืมคนอื่นมา - ต้องจ่ายคืน)
                    </h2>
                    <p style={{ fontSize: '0.8rem', color: '#64748b' }}>
                      ยอดที่ต้องคืนทั้งหมด: <strong>{formatTHB(summary.totalPayableLoans)}</strong>
                    </p>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {visibleLoans.filter((l) => l.loanType === 'borrow').length === 0 ? (
                      <div style={{ padding: 20, textAlign: 'center', color: '#64748b', fontSize: '0.86rem' }}>
                        ยังไม่มีรายการยืมเงิน
                      </div>
                    ) : (
                      visibleLoans
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
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8, gap: 8 }}>
                                <div>
                                  <div style={{ fontWeight: 800, fontSize: '1rem', display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
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
                                  <button
                                    type="button"
                                    onClick={() => openEditLoanModal(loan)}
                                    className="btn btn-outline btn-sm"
                                    style={{ padding: '4px 8px' }}
                                  >
                                    ✏️
                                  </button>
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
                            </div>
                          );
                        })
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ================================================================= */}
          {/* TAB 4: DESKTOP ANALYTICS & REPORTS */}
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

              <div className="card">
                <h2 style={{ fontSize: '1.05rem', fontWeight: 800, marginBottom: 14 }}>
                  🍩 สัดส่วนรายจ่ายแยกตามหมวดหมู่
                </h2>
                {summary.totalExpense <= 0 ? (
                  <div style={{ padding: 20, textAlign: 'center', color: '#64748b' }}>
                    ยังไม่มีรายการรายจ่ายในเดือนนี้
                  </div>
                ) : (
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
                )}
              </div>
            </div>
          )}

          {/* ================================================================= */}
          {/* TAB 5: FAMILY SHARING */}
          {/* ================================================================= */}
          {activeTab === 'family' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
              <div>
                <h1 style={{ fontSize: '1.35rem', fontWeight: 800 }}>
                  🏠 พื้นที่ครอบครัว & แชร์ยอดรวมกับคนในบ้าน
                </h1>
                <p style={{ fontSize: '0.86rem', color: '#64748b' }}>
                  สร้างบ้านของคุณเพื่อรับรหัสเชิญ หรือกรอกรหัสบ้านเพื่อแชร์ยอดรวมกับคนในครอบครัว
                </p>
              </div>

              <div className="grid-2">
                <div className="card">
                  {!currentFamily ? (
                    <div>
                      <h2 style={{ fontSize: '1.05rem', fontWeight: 800, marginBottom: 12 }}>
                        🏡 สร้างพื้นที่ครอบครัวใหม่ หรือ เข้าร่วมบ้าน
                      </h2>
                      <form onSubmit={handleCreateFamilyGroup} style={{ marginBottom: 20 }}>
                        <div className="form-group">
                          <label className="form-label">ตั้งชื่อบ้านของคุณ</label>
                          <div style={{ display: 'flex', gap: 8 }}>
                            <input
                              type="text"
                              className="form-input"
                              placeholder={`เช่น บ้านของ ${currentUser.name}`}
                              value={newFamilyName}
                              onChange={(e) => setNewFamilyName(e.target.value)}
                            />
                            <button type="submit" className="btn btn-primary">
                              สร้างบ้าน
                            </button>
                          </div>
                        </div>
                      </form>

                      <form onSubmit={handleJoinFamilyByCode}>
                        <div className="form-group">
                          <label className="form-label">หรือมีรหัสเข้าบ้านของคนในครอบครัวแล้ว?</label>
                          <div style={{ display: 'flex', gap: 8 }}>
                            <input
                              type="text"
                              className="form-input"
                              placeholder="เช่น HOME-1234"
                              value={joinCodeInput}
                              onChange={(e) => setJoinCodeInput(e.target.value)}
                            />
                            <button type="submit" className="btn btn-outline">
                              เข้าร่วมบ้าน
                            </button>
                          </div>
                        </div>
                      </form>
                    </div>
                  ) : (
                    <>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                        <h2 style={{ fontSize: '1.05rem', fontWeight: 800 }}>
                          👨‍👩‍👧‍👦 บ้านของคุณ: {currentFamily.name}
                        </h2>
                        <button
                          type="button"
                          onClick={openEditProfileModal}
                          className="btn btn-outline btn-sm"
                        >
                          ✏️ แก้ไขชื่อบ้าน
                        </button>
                      </div>
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
                          {currentFamily.memberEmails.map((email) => (
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
                              <span>{email}</span>
                              {email === currentUser.email ? (
                                <span className="badge badge-indigo">คุณ</span>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => handleRemoveFamilyMember(email)}
                                  className="btn btn-outline btn-sm"
                                  style={{ padding: '2px 8px', color: '#dc2626' }}
                                >
                                  ลบออก
                                </button>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>

                      <form onSubmit={handleInviteFamilyEmail}>
                        <div className="form-group">
                          <label className="form-label">เพิ่ม Gmail ของคนในบ้าน</label>
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
                    🔒 ตั้งค่าและแก้ไขบัญชีของฉัน ({currentUser.email})
                  </h2>
                  <p style={{ fontSize: '0.8rem', color: '#64748b', marginBottom: 14 }}>
                    เลือกเปิด <strong>&ldquo;🏠 แชร์กับบ้าน&rdquo;</strong> หรือกด <strong>✏️ แก้ไข</strong> เพื่อเปลี่ยนชื่อบัญชีและยอดเงิน
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
                            gap: 8,
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
                          <div style={{ display: 'flex', gap: 6 }}>
                            <button
                              type="button"
                              onClick={() => openEditAccountModal(acc)}
                              className="btn btn-outline btn-sm"
                            >
                              ✏️ แก้ไข
                            </button>
                            <button
                              type="button"
                              onClick={() => handleToggleAccountShare(acc.id)}
                              className={`btn btn-sm ${
                                acc.isSharedWithFamily ? 'btn-primary' : 'btn-outline'
                              }`}
                            >
                              {acc.isSharedWithFamily ? '🏠 แชร์อยู่' : '🔒 ส่วนตัว'}
                            </button>
                          </div>
                        </div>
                      ))}
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
      {/* MODAL 1: เพิ่ม / แก้ไข รายรับ-รายจ่าย-โอนเงิน */}
      {/* ===================================================================== */}
      {showTxModal && (
        <div className="modal-backdrop" onClick={() => setShowTxModal(false)}>
          <div className="modal-panel" onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ fontSize: '1.15rem', fontWeight: 800 }}>
                {editingTx ? '✏️ แก้ไขรายการ' : '📝 บันทึกรายการใหม่'}
              </h3>
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
                  if (!editingTx) setTxCategory('food');
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
                  if (!editingTx) setTxCategory('salary');
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

            <form onSubmit={handleSaveTransaction}>
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
                    if (acc && !editingTx) setTxShared(Boolean(acc.isSharedWithFamily));
                  }}
                >
                  {visibleAccounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {ACCOUNT_TYPE_META[a.type]?.icon} {a.name}
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

              {!editingTx &&
                txType === 'expense' &&
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

              <div style={{ display: 'flex', gap: 8 }}>
                {editingTx && (
                  <button
                    type="button"
                    onClick={() => handleDeleteTransaction(editingTx)}
                    className="btn btn-danger"
                  >
                    🗑️ ลบรายการ
                  </button>
                )}
                <button type="submit" className="btn btn-primary" style={{ flex: 1 }}>
                  ✅ {editingTx ? 'บันทึกการแก้ไข' : 'บันทึกรายการ'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* MODAL 2: สร้าง / แก้ไข บัญชีธนาคาร / บัตรเครดิต / PayLater */}
      {/* ===================================================================== */}
      {showAccountModal && (
        <div className="modal-backdrop" onClick={() => setShowAccountModal(false)}>
          <div className="modal-panel" onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ fontSize: '1.15rem', fontWeight: 800 }}>
                {editingAccount ? '✏️ แก้ไขข้อมูลบัญชี / บัตร' : '💳 เพิ่มบัญชีใหม่ / บัตรเครดิต / PayLater'}
              </h3>
              <button type="button" onClick={() => setShowAccountModal(false)} className="btn btn-ghost btn-sm">
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveAccount}>
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
                  <label className="form-label">ยอดเงินคงเหลือ (บาท)</label>
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

              <div className="form-group">
                <label className="form-label">สีของการ์ดบัญชี/บัตร</label>
                <div style={{ display: 'flex', gap: 10 }}>
                  {['#059669', '#0284c7', '#4f46e5', '#7c3aed', '#db2777', '#ea580c', '#1e293b', '#b91c1c'].map((col) => (
                    <button
                      key={col}
                      type="button"
                      onClick={() => setAccColor(col)}
                      style={{
                        width: 30,
                        height: 30,
                        borderRadius: '50%',
                        background: col,
                        border: accColor === col ? '3px solid #0f172a' : '2px solid transparent',
                        cursor: 'pointer',
                      }}
                    />
                  ))}
                </div>
              </div>

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

              <div style={{ display: 'flex', gap: 8 }}>
                {editingAccount && (
                  <button
                    type="button"
                    onClick={() => handleDeleteAccount(editingAccount)}
                    className="btn btn-danger"
                  >
                    🗑️ ลบบัญชี
                  </button>
                )}
                <button type="submit" className="btn btn-primary" style={{ flex: 1 }}>
                  ✅ {editingAccount ? 'บันทึกการแก้ไข' : 'สร้างบัญชี / บัตร'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* MODAL 3: จ่ายบิลบัตรเครดิต */}
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
      {/* MODAL 4: เพิ่ม / แก้ไข รายการผ่อนชำระ */}
      {/* ===================================================================== */}
      {showInstallmentModal && (
        <div className="modal-backdrop" onClick={() => setShowInstallmentModal(false)}>
          <div className="modal-panel" onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <h3 style={{ fontSize: '1.15rem', fontWeight: 800 }}>
                {editingInstallment ? '✏️ แก้ไขรายการผ่อนสินค้า' : '📅 เพิ่มรายการผ่อนสินค้า (0% / ผ่อนบัตร)'}
              </h3>
              <button type="button" onClick={() => setShowInstallmentModal(false)} className="btn btn-ghost btn-sm">
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveInstallment}>
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
                  <label className="form-label">จำนวนงวดทั้งหมด (เดือน)</label>
                  <input
                    type="number"
                    min="1"
                    max="60"
                    className="form-input"
                    value={instMonths}
                    onChange={(e) => setInstMonths(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">จ่ายไปแล้วกี่งวด</label>
                <input
                  type="number"
                  min="0"
                  max="60"
                  className="form-input"
                  value={instPaidMonths}
                  onChange={(e) => setInstPaidMonths(e.target.value)}
                />
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

              <div style={{ display: 'flex', gap: 8 }}>
                {editingInstallment && (
                  <button
                    type="button"
                    onClick={() => handleDeleteInstallment(editingInstallment)}
                    className="btn btn-danger"
                  >
                    🗑️ ลบ
                  </button>
                )}
                <button
                  type="submit"
                  onClick={() => {
                    if (!instAccountId && creditAccounts[0]) {
                      setInstAccountId(creditAccounts[0].id);
                    }
                  }}
                  className="btn btn-primary"
                  style={{ flex: 1 }}
                >
                  ✅ {editingInstallment ? 'บันทึกการแก้ไข' : 'บันทึกรายการผ่อนชำระ'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* MODAL 5: สร้าง / แก้ไข การยืมเงิน / ให้คนอื่นยืมเงิน */}
      {/* ===================================================================== */}
      {showLoanModal && (
        <div className="modal-backdrop" onClick={() => setShowLoanModal(false)}>
          <div className="modal-panel" onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <h3 style={{ fontSize: '1.15rem', fontWeight: 800 }}>
                {editingLoan ? '✏️ แก้ไขรายการยืม / ให้ยืม' : '🤝 สร้างรายการยืมเงิน / ให้ยืมเงิน'}
              </h3>
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

            <form onSubmit={handleSaveLoan}>
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

              <div className="grid-2">
                <div className="form-group">
                  <label className="form-label">จำนวนเงินทั้งหมด (บาท)</label>
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
                  <label className="form-label">คืนมาแล้ว / จ่ายแล้ว (บาท)</label>
                  <input
                    type="number"
                    step="0.01"
                    className="form-input"
                    placeholder="0.00"
                    value={loanPaidAmount}
                    onChange={(e) => setLoanPaidAmount(e.target.value)}
                  />
                </div>
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

              <div style={{ display: 'flex', gap: 8 }}>
                {editingLoan && (
                  <button
                    type="button"
                    onClick={() => handleDeleteLoan(editingLoan)}
                    className="btn btn-danger"
                  >
                    🗑️ ลบรายการ
                  </button>
                )}
                <button type="submit" className="btn btn-primary" style={{ flex: 1 }}>
                  ✅ {editingLoan ? 'บันทึกการแก้ไข' : 'บันทึกรายการ'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* MODAL 6: รับเงินคืน / จ่ายคืนหนี้ */}
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

      {/* ===================================================================== */}
      {/* MODAL 7: แก้ไขชื่อโปรไฟล์ & ชื่อบ้าน */}
      {/* ===================================================================== */}
      {showEditProfileModal && (
        <div className="modal-backdrop" onClick={() => setShowEditProfileModal(false)}>
          <div className="modal-panel" onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <h3 style={{ fontSize: '1.15rem', fontWeight: 800 }}>
                ✏️ แก้ไขชื่อแสดงผล & ชื่อบ้าน
              </h3>
              <button type="button" onClick={() => setShowEditProfileModal(false)} className="btn btn-ghost btn-sm">
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveProfileAndFamily}>
              <div className="form-group">
                <label className="form-label">ชื่อที่ใช้แสดงของคุณ ({currentUser.email})</label>
                <input
                  type="text"
                  className="form-input"
                  value={profileNameInput}
                  onChange={(e) => setProfileNameInput(e.target.value)}
                  required
                />
              </div>

              {currentFamily && (
                <div className="form-group">
                  <label className="form-label">ชื่อบ้านครอบครัว ({currentFamily.inviteCode})</label>
                  <input
                    type="text"
                    className="form-input"
                    value={familyNameEditInput}
                    onChange={(e) => setFamilyNameEditInput(e.target.value)}
                  />
                </div>
              )}

              <button type="submit" className="btn btn-primary" style={{ width: '100%' }}>
                ✅ บันทึกการเปลี่ยนแปลง
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
