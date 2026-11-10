'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  EXPENSE_CATEGORIES,
  INCOME_CATEGORIES,
  ACCOUNT_TYPE_META,
  CLOUD_SYNC_TOPIC,
  loadAppState,
  saveAppState,
  syncWithCloud,
  pushStateToCloud,
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
  const [familyMemberFilter, setFamilyMemberFilter] = useState('all'); // 'all' | email

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
  const [txShared, setTxShared] = useState(true);

  // Account / Card Form State
  const [accName, setAccName] = useState('');
  const [accType, setAccType] = useState('bank');
  const [accBalance, setAccBalance] = useState('');
  const [accCreditLimit, setAccCreditLimit] = useState('50000');
  const [accUsedAmount, setAccUsedAmount] = useState('0');
  const [accStatementDay, setAccStatementDay] = useState('25');
  const [accDueDay, setAccDueDay] = useState('10');
  const [accColor, setAccColor] = useState('#4f46e5');
  const [accShared, setAccShared] = useState(true);

  // Pay Credit Card Modal State
  const [payCardFromAccId, setPayCardFromAccId] = useState('');
  const [payCardAmount, setPayCardAmount] = useState('');

  // Installment Form State
  const [instTitle, setInstTitle] = useState('');
  const [instAccountId, setInstAccountId] = useState('');
  const [instTotalAmount, setInstTotalAmount] = useState('');
  const [instMonths, setInstMonths] = useState('10');
  const [instPaidMonths, setInstPaidMonths] = useState('0');
  const [instShared, setInstShared] = useState(true);

  // Loan Form State
  const [loanType, setLoanType] = useState('lend');
  const [loanPerson, setLoanPerson] = useState('');
  const [loanAmount, setLoanAmount] = useState('');
  const [loanPaidAmount, setLoanPaidAmount] = useState('0');
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

  // All Transactions Page Filter State
  const [txFilterType, setTxFilterType] = useState('all'); // 'all' | 'expense' | 'income' | 'card_payment' | 'transfer'
  const [txFilterAccountId, setTxFilterAccountId] = useState('all');
  const [txFilterCategory, setTxFilterCategory] = useState('all');
  const [txSearchQuery, setTxSearchQuery] = useState('');
  const [txFilterMonth, setTxFilterMonth] = useState('all');

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
      pushStateToCloud(next);
      return next;
    });
  };

  const completeUserSession = async (stateSnapshot, email, name, pictureUrl) => {
    const cleanEmail = (email || '').trim().toLowerCase();
    if (!cleanEmail) return;

    const syncedState = await syncWithCloud(stateSnapshot);

    const existingUser = syncedState.users.find(
      (u) => u.email.toLowerCase() === cleanEmail
    );
    if (existingUser) {
      setAppState(syncedState);
      setCurrentUser(existingUser);
      saveCurrentUser(existingUser);
      return;
    }

    const fallbackName = cleanEmail.split('@')[0];
    const displayName = (name || fallbackName).trim();
    const joinedFamily = syncedState.familyGroups.find((fg) =>
      fg.memberEmails.includes(cleanEmail)
    );

    const newUser = {
      email: cleanEmail,
      name: displayName,
      avatar: pictureUrl || displayName.slice(0, 1).toUpperCase(),
      familyId: joinedFamily ? joinedFamily.id : null,
      updatedAt: Date.now(),
    };

    const today = new Date().toISOString().slice(0, 10);
    const starterCashAcc = {
      id: `acc-${Date.now()}`,
      ownerEmail: cleanEmail,
      ownerName: displayName,
      familyId: newUser.familyId,
      isSharedWithFamily: true,
      name: 'กระเป๋าเงินสด',
      type: 'cash',
      balance: 0,
      creditLimit: 0,
      usedAmount: 0,
      statementDay: 1,
      dueDay: 1,
      color: '#059669',
      createdAt: today,
      updatedAt: Date.now(),
    };

    const nextState = {
      ...syncedState,
      users: [...syncedState.users, newUser],
      accounts: [...syncedState.accounts, starterCashAcc],
    };
    saveAppState(nextState);
    setAppState(nextState);
    setCurrentUser(newUser);
    saveCurrentUser(newUser);
    pushStateToCloud(nextState);
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
    } else {
      syncWithCloud(loadedState).then((merged) => setAppState(merged));
    }

    setHydrated(true);
  }, []);

  // Real-time SSE stream + window focus sync so Mobile & PC stay in sync instantly without rate-limit polling
  useEffect(() => {
    if (!hydrated || typeof window === 'undefined') return;

    let debounceTimer = null;
    const triggerSync = () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(async () => {
        const currentLocal = loadAppState();
        const merged = await syncWithCloud(currentLocal);
        setAppState(merged);
      }, 400);
    };

    let es = null;
    if (typeof window.EventSource !== 'undefined') {
      try {
        es = new window.EventSource(`https://ntfy.sh/${CLOUD_SYNC_TOPIC}/sse`);
        es.onmessage = () => {
          triggerSync();
        };
      } catch {
        // Ignore SSE errors
      }
    }

    const onFocus = () => triggerSync();
    const onVisibility = () => {
      if (document.visibilityState === 'visible') triggerSync();
    };
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVisibility);

    const fallbackInterval = setInterval(triggerSync, 25000);

    return () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      if (es) es.close();
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVisibility);
      clearInterval(fallbackInterval);
    };
  }, [hydrated]);

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

  // ============================================================================
  // GMAIL CONSENT-BASED FAMILY SHARING (shareConnections)
  // ============================================================================
  const myConnections = useMemo(() => {
    if (!appState || !currentUser) return [];
    const list = Array.isArray(appState.shareConnections) ? appState.shareConnections : [];
    const myEmail = currentUser.email.toLowerCase();
    return list.filter(
      (c) =>
        (c.fromEmail?.toLowerCase() === myEmail || c.toEmail?.toLowerCase() === myEmail) &&
        c.status !== 'declined'
    );
  }, [appState, currentUser]);

  const pendingIncomingInvites = useMemo(() => {
    if (!currentUser) return [];
    const myEmail = currentUser.email.toLowerCase();
    return myConnections.filter(
      (c) => c.toEmail?.toLowerCase() === myEmail && c.status === 'pending'
    );
  }, [myConnections, currentUser]);

  const pendingOutgoingInvites = useMemo(() => {
    if (!currentUser) return [];
    const myEmail = currentUser.email.toLowerCase();
    return myConnections.filter(
      (c) => c.fromEmail?.toLowerCase() === myEmail && c.status === 'pending'
    );
  }, [myConnections, currentUser]);

  const acceptedConnections = useMemo(() => {
    return myConnections.filter((c) => c.status === 'accepted');
  }, [myConnections]);

  // Emails of family members who have ACCEPTED our connection AND currently have their share switch ENABLED
  const sharedByOthersEmails = useMemo(() => {
    if (!currentUser) return [];
    const myEmail = currentUser.email.toLowerCase();
    const emails = new Set();
    acceptedConnections.forEach((c) => {
      const fromEm = c.fromEmail?.toLowerCase();
      const toEm = c.toEmail?.toLowerCase();
      if (fromEm === myEmail && c.toShareEnabled !== false) {
        emails.add(toEm);
      } else if (toEm === myEmail && c.fromShareEnabled !== false) {
        emails.add(fromEm);
      }
    });
    return Array.from(emails);
  }, [acceptedConnections, currentUser]);

  // Current user's own accounts (for form dropdowns so you never modify someone else's account)
  const myAccounts = useMemo(() => {
    if (!appState || !currentUser) return [];
    return appState.accounts.filter((a) => a.ownerEmail === currentUser.email);
  }, [appState, currentUser]);

  const myAssetAccounts = useMemo(
    () => myAccounts.filter((a) => !ACCOUNT_TYPE_META[a.type]?.isLiability),
    [myAccounts]
  );

  const myCreditAccounts = useMemo(
    () => myAccounts.filter((a) => ACCOUNT_TYPE_META[a.type]?.isLiability),
    [myAccounts]
  );

  const canSeeItem = (item) => {
    if (!currentUser || !item) return false;
    const owner = (item.ownerEmail || '').toLowerCase();
    const me = currentUser.email.toLowerCase();
    if (viewMode === 'personal') {
      return owner === me;
    }
    // In family view:
    if (familyMemberFilter !== 'all') {
      if (owner !== familyMemberFilter.toLowerCase()) return false;
      if (owner === me) return true;
      return sharedByOthersEmails.includes(owner) && item.isSharedWithFamily !== false;
    }
    if (owner === me) return true;
    return sharedByOthersEmails.includes(owner) && item.isSharedWithFamily !== false;
  };

  const visibleAccounts = useMemo(() => {
    if (!appState || !currentUser) return [];
    return appState.accounts.filter(canSeeItem);
  }, [appState, currentUser, viewMode, familyMemberFilter, sharedByOthersEmails]);

  const visibleInstallments = useMemo(() => {
    if (!appState || !currentUser) return [];
    return appState.installments.filter(canSeeItem);
  }, [appState, currentUser, viewMode, familyMemberFilter, sharedByOthersEmails]);

  const visibleTransactions = useMemo(() => {
    if (!appState || !currentUser) return [];
    return appState.transactions.filter(canSeeItem);
  }, [appState, currentUser, viewMode, familyMemberFilter, sharedByOthersEmails]);

  const availableTxMonths = useMemo(() => {
    const months = new Set();
    visibleTransactions.forEach((tx) => {
      if (tx.txDate && tx.txDate.length >= 7) {
        months.add(tx.txDate.slice(0, 7));
      }
    });
    return Array.from(months).sort().reverse();
  }, [visibleTransactions]);

  const filteredAllTransactions = useMemo(() => {
    return visibleTransactions.filter((tx) => {
      if (txFilterType !== 'all') {
        if (txFilterType === 'transfer_or_card') {
          if (tx.type !== 'transfer' && tx.type !== 'card_payment') return false;
        } else if (tx.type !== txFilterType) {
          return false;
        }
      }
      if (txFilterAccountId !== 'all' && tx.accountId !== txFilterAccountId && tx.toAccountId !== txFilterAccountId) {
        return false;
      }
      if (txFilterCategory !== 'all' && tx.category !== txFilterCategory) {
        return false;
      }
      if (txFilterMonth !== 'all' && (!tx.txDate || !tx.txDate.startsWith(txFilterMonth))) {
        return false;
      }
      if (txSearchQuery.trim()) {
        const q = txSearchQuery.trim().toLowerCase();
        const acc = appState?.accounts?.find((a) => a.id === tx.accountId);
        const allCats = [...EXPENSE_CATEGORIES, ...INCOME_CATEGORIES];
        const cat = allCats.find((c) => c.id === tx.category);
        const matchNote = (tx.note || '').toLowerCase().includes(q);
        const matchOwner = (tx.ownerName || '').toLowerCase().includes(q);
        const matchAcc = (acc?.name || '').toLowerCase().includes(q);
        const matchCat = (cat?.label || '').toLowerCase().includes(q);
        const matchAmount = String(tx.amount || '').includes(q);
        if (!matchNote && !matchOwner && !matchAcc && !matchCat && !matchAmount) return false;
      }
      return true;
    });
  }, [
    visibleTransactions,
    txFilterType,
    txFilterAccountId,
    txFilterCategory,
    txFilterMonth,
    txSearchQuery,
    appState,
  ]);

  const visibleLoans = useMemo(() => {
    if (!appState || !currentUser) return [];
    return appState.loans.filter(canSeeItem);
  }, [appState, currentUser, viewMode, familyMemberFilter, sharedByOthersEmails]);

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
    const now = Date.now();

    updateState((prev) => ({
      ...prev,
      users: prev.users.map((u) =>
        u.email === currentUser.email ? { ...u, name: newName, updatedAt: now } : u
      ),
      accounts: prev.accounts.map((a) =>
        a.ownerEmail === currentUser.email ? { ...a, ownerName: newName, updatedAt: now } : a
      ),
      transactions: prev.transactions.map((t) =>
        t.ownerEmail === currentUser.email ? { ...t, ownerName: newName, updatedAt: now } : t
      ),
      installments: prev.installments.map((inst) =>
        inst.ownerEmail === currentUser.email ? { ...inst, ownerName: newName, updatedAt: now } : inst
      ),
      loans: prev.loans.map((l) =>
        l.ownerEmail === currentUser.email ? { ...l, ownerName: newName, updatedAt: now } : l
      ),
      shareConnections: (prev.shareConnections || []).map((c) => {
        if (c.fromEmail?.toLowerCase() === currentUser.email.toLowerCase()) {
          return { ...c, fromName: newName, updatedAt: now };
        }
        if (c.toEmail?.toLowerCase() === currentUser.email.toLowerCase()) {
          return { ...c, toName: newName, updatedAt: now };
        }
        return c;
      }),
      familyGroups: prev.familyGroups.map((fg) =>
        currentFamily && fg.id === currentFamily.id && newHouseName
          ? { ...fg, name: newHouseName, updatedAt: now }
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
    const firstAcc = myAccounts[0];
    if (firstAcc) {
      setTxAccountId(firstAcc.id);
      setTxShared(firstAcc.isSharedWithFamily !== false);
    }
    const secondAcc = myAccounts[1];
    if (secondAcc) {
      setTxToAccountId(secondAcc.id);
    }
    setTxDate(new Date().toISOString().slice(0, 10));
    setShowTxModal(true);
  };

  const openEditTransactionModal = (tx) => {
    if (tx.ownerEmail !== currentUser.email) {
      showToast('รายการของคนในบ้านเป็นโหมดดูอย่างเดียว ไม่สามารถแก้ไขได้');
      return;
    }
    setEditingTx(tx);
    setTxType(tx.type === 'card_payment' ? 'transfer' : tx.type);
    setTxAmount(String(tx.amount));
    setTxCategory(tx.category || 'food');
    setTxAccountId(tx.accountId);
    setTxToAccountId(tx.toAccountId || '');
    setTxNote(tx.note || '');
    setTxDate(tx.txDate || new Date().toISOString().slice(0, 10));
    setTxShared(tx.isSharedWithFamily !== false);
    setTxIsInstallment(false);
    setShowTxModal(true);
  };

  // Helper to apply or reverse a transaction's balance effect on accounts
  const applyTxEffectToAccounts = (accountsList, tx, multiplier = 1) => {
    const amt = Number(tx.amount || 0) * multiplier;
    const now = Date.now();
    return accountsList.map((acc) => {
      if (tx.type === 'income' && acc.id === tx.accountId) {
        if (ACCOUNT_TYPE_META[acc.type]?.isLiability) {
          return { ...acc, usedAmount: Math.max(0, Number(acc.usedAmount) - amt), updatedAt: now };
        }
        return { ...acc, balance: Number(acc.balance) + amt, updatedAt: now };
      }
      if (tx.type === 'expense' && acc.id === tx.accountId) {
        if (ACCOUNT_TYPE_META[acc.type]?.isLiability) {
          return { ...acc, usedAmount: Math.max(0, Number(acc.usedAmount) + amt), updatedAt: now };
        }
        return { ...acc, balance: Number(acc.balance) - amt, updatedAt: now };
      }
      if (tx.type === 'transfer' || tx.type === 'card_payment') {
        if (acc.id === tx.accountId) {
          return { ...acc, balance: Number(acc.balance) - amt, updatedAt: now };
        }
        if (acc.id === tx.toAccountId) {
          if (ACCOUNT_TYPE_META[acc.type]?.isLiability) {
            return { ...acc, usedAmount: Math.max(0, Number(acc.usedAmount) - amt), updatedAt: now };
          }
          return { ...acc, balance: Number(acc.balance) + amt, updatedAt: now };
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
    if (!selectedAcc || selectedAcc.ownerEmail !== currentUser.email) return;

    const isCreditOrBnpl = ACCOUNT_TYPE_META[selectedAcc.type]?.isLiability;
    const today = txDate || new Date().toISOString().slice(0, 10);
    const now = Date.now();

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
        id: editingTx ? editingTx.id : `tx-${now}`,
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
        updatedAt: now,
      };

      workingAccounts = applyTxEffectToAccounts(workingAccounts, updatedTxObj, 1);

      let updatedInstallments = prev.installments;
      if (!editingTx && txType === 'expense' && isCreditOrBnpl && txIsInstallment) {
        const months = Math.max(2, parseInt(txInstallmentMonths, 10) || 6);
        const newInst = {
          id: `inst-${now}`,
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
          updatedAt: now,
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
    if (txToDelete.ownerEmail !== currentUser.email) return;
    updateState((prev) => ({
      ...prev,
      accounts: applyTxEffectToAccounts(prev.accounts, txToDelete, -1),
      transactions: prev.transactions.filter((t) => t.id !== txToDelete.id),
      deletedIds: [...(prev.deletedIds || []), txToDelete.id],
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
    setAccShared(true);
    setShowAccountModal(true);
  };

  const openEditAccountModal = (acc) => {
    if (acc.ownerEmail !== currentUser.email) {
      showToast('บัญชีของคนในบ้านเป็นโหมดดูอย่างเดียว ไม่สามารถแก้ไขได้');
      return;
    }
    setEditingAccount(acc);
    setAccType(acc.type);
    setAccName(acc.name);
    setAccBalance(String(acc.balance || 0));
    setAccCreditLimit(String(acc.creditLimit || 50000));
    setAccUsedAmount(String(acc.usedAmount || 0));
    setAccStatementDay(String(acc.statementDay || 25));
    setAccDueDay(String(acc.dueDay || 10));
    setAccColor(acc.color || '#4f46e5');
    setAccShared(acc.isSharedWithFamily !== false);
    setShowAccountModal(true);
  };

  const handleSaveAccount = (e) => {
    e.preventDefault();
    if (!accName.trim()) return;
    const isLiability = ACCOUNT_TYPE_META[accType]?.isLiability;
    const today = new Date().toISOString().slice(0, 10);
    const now = Date.now();

    if (editingAccount) {
      if (editingAccount.ownerEmail !== currentUser.email) return;
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
                updatedAt: now,
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
      id: `acc-${now}`,
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
      updatedAt: now,
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
    if (accToDelete.ownerEmail !== currentUser.email) return;
    updateState((prev) => {
      const removedInstIds = prev.installments
        .filter((i) => i.accountId === accToDelete.id)
        .map((i) => i.id);
      const removedTxIds = prev.transactions
        .filter((t) => t.accountId === accToDelete.id)
        .map((t) => t.id);
      return {
        ...prev,
        accounts: prev.accounts.filter((a) => a.id !== accToDelete.id),
        installments: prev.installments.filter((i) => i.accountId !== accToDelete.id),
        transactions: prev.transactions.filter((t) => t.accountId !== accToDelete.id),
        deletedIds: [...(prev.deletedIds || []), accToDelete.id, ...removedInstIds, ...removedTxIds],
      };
    });
    setShowAccountModal(false);
    setEditingAccount(null);
    showToast(`ลบบัญชี "${accToDelete.name}" เรียบร้อยแล้ว`);
  };

  // Pay Credit Card / BNPL Bill
  const handlePayCreditCardBill = (e) => {
    e.preventDefault();
    if (!showPayCardModal || !payCardFromAccId) return;
    if (showPayCardModal.ownerEmail !== currentUser.email) return;
    const amount = parseFloat(payCardAmount);
    if (!amount || amount <= 0) return;

    const cardAcc = showPayCardModal;
    const bankAcc = appState.accounts.find((a) => a.id === payCardFromAccId);
    if (!bankAcc || bankAcc.ownerEmail !== currentUser.email) return;

    const today = new Date().toISOString().slice(0, 10);
    const now = Date.now();

    updateState((prev) => ({
      ...prev,
      accounts: prev.accounts.map((a) => {
        if (a.id === bankAcc.id) {
          return { ...a, balance: Number(a.balance) - amount, updatedAt: now };
        }
        if (a.id === cardAcc.id) {
          return { ...a, usedAmount: Math.max(0, Number(a.usedAmount) - amount), updatedAt: now };
        }
        return a;
      }),
      transactions: [
        {
          id: `tx-${now}`,
          ownerEmail: currentUser.email,
          ownerName: currentUser.name,
          isSharedWithFamily: cardAcc.isSharedWithFamily !== false,
          type: 'card_payment',
          amount,
          category: 'transfer',
          note: `จ่ายบิล ${cardAcc.name} (ตัดจาก ${bankAcc.name})`,
          accountId: bankAcc.id,
          toAccountId: cardAcc.id,
          txDate: today,
          createdAt: today,
          updatedAt: now,
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
    setInstAccountId(myCreditAccounts[0]?.id || '');
    setInstTotalAmount('');
    setInstMonths('10');
    setInstPaidMonths('0');
    setInstShared(true);
    setShowInstallmentModal(true);
  };

  const openEditInstallmentModal = (inst) => {
    if (inst.ownerEmail !== currentUser.email) {
      showToast('รายการของคนในบ้านเป็นโหมดดูอย่างเดียว ไม่สามารถแก้ไขได้');
      return;
    }
    setEditingInstallment(inst);
    setInstTitle(inst.title);
    setInstAccountId(inst.accountId);
    setInstTotalAmount(String(inst.totalAmount));
    setInstMonths(String(inst.totalMonths));
    setInstPaidMonths(String(inst.paidMonths || 0));
    setInstShared(inst.isSharedWithFamily !== false);
    setShowInstallmentModal(true);
  };

  const handleSaveInstallment = (e) => {
    e.preventDefault();
    const total = parseFloat(instTotalAmount);
    const months = Math.max(1, parseInt(instMonths, 10) || 10);
    const paid = Math.min(months, Math.max(0, parseInt(instPaidMonths, 10) || 0));
    const targetAccId = instAccountId || myCreditAccounts[0]?.id;
    if (!instTitle.trim() || !total || total <= 0 || !targetAccId) return;

    const today = new Date().toISOString().slice(0, 10);
    const monthly = Math.round((total / months) * 100) / 100;
    const now = Date.now();

    if (editingInstallment) {
      if (editingInstallment.ownerEmail !== currentUser.email) return;
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
                updatedAt: now,
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
        a.id === targetAccId ? { ...a, usedAmount: Number(a.usedAmount) + total, updatedAt: now } : a
      ),
      installments: [
        {
          id: `inst-${now}`,
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
          updatedAt: now,
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
    if (instToDelete.ownerEmail !== currentUser.email) return;
    updateState((prev) => ({
      ...prev,
      installments: prev.installments.filter((i) => i.id !== instToDelete.id),
      deletedIds: [...(prev.deletedIds || []), instToDelete.id],
    }));
    setShowInstallmentModal(false);
    setEditingInstallment(null);
    showToast('ลบรายการผ่อนชำระแล้ว');
  };

  const handleAdvanceInstallmentMonth = (inst) => {
    if (inst.ownerEmail !== currentUser.email) return;
    if (inst.paidMonths >= inst.totalMonths) return;
    const now = Date.now();
    updateState((prev) => ({
      ...prev,
      installments: prev.installments.map((item) =>
        item.id === inst.id ? { ...item, paidMonths: item.paidMonths + 1, updatedAt: now } : item
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
    setLoanAccountId(myAssetAccounts[0]?.id || '');
    setLoanDueDate(new Date().toISOString().slice(0, 10));
    setLoanNote('');
    setLoanShared(true);
    setShowLoanModal(true);
  };

  const openEditLoanModal = (loan) => {
    if (loan.ownerEmail !== currentUser.email) {
      showToast('รายการของคนในบ้านเป็นโหมดดูอย่างเดียว ไม่สามารถแก้ไขได้');
      return;
    }
    setEditingLoan(loan);
    setLoanType(loan.loanType);
    setLoanPerson(loan.personName);
    setLoanAmount(String(loan.totalAmount));
    setLoanPaidAmount(String(loan.paidAmount || 0));
    setLoanAccountId(loan.accountId || myAssetAccounts[0]?.id || '');
    setLoanDueDate(loan.dueDate || new Date().toISOString().slice(0, 10));
    setLoanNote(loan.note || '');
    setLoanShared(loan.isSharedWithFamily !== false);
    setShowLoanModal(true);
  };

  const handleSaveLoan = (e) => {
    e.preventDefault();
    const amount = parseFloat(loanAmount);
    const paid = Math.min(amount, Math.max(0, parseFloat(loanPaidAmount) || 0));
    if (!loanPerson.trim() || !amount || amount <= 0) return;

    const today = new Date().toISOString().slice(0, 10);
    const now = Date.now();

    if (editingLoan) {
      if (editingLoan.ownerEmail !== currentUser.email) return;
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
                updatedAt: now,
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
      id: `loan-${now}`,
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
      updatedAt: now,
    };

    updateState((prev) => ({
      ...prev,
      accounts: prev.accounts.map((a) => {
        if (a.id !== loanAccountId || a.ownerEmail !== currentUser.email) return a;
        return {
          ...a,
          balance:
            loanType === 'lend'
              ? Number(a.balance) - amount
              : Number(a.balance) + amount,
          updatedAt: now,
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
    if (loanToDelete.ownerEmail !== currentUser.email) return;
    updateState((prev) => ({
      ...prev,
      loans: prev.loans.filter((l) => l.id !== loanToDelete.id),
      deletedIds: [...(prev.deletedIds || []), loanToDelete.id],
    }));
    setShowLoanModal(false);
    setEditingLoan(null);
    showToast(`ลบรายการของ "${loanToDelete.personName}" แล้ว`);
  };

  const handleRecordLoanRepayment = (e) => {
    e.preventDefault();
    if (!showRepayLoanModal || !repayAccountId) return;
    if (showRepayLoanModal.ownerEmail !== currentUser.email) return;
    const amount = parseFloat(repayAmount);
    if (!amount || amount <= 0) return;

    const targetLoan = showRepayLoanModal;
    const today = new Date().toISOString().slice(0, 10);
    const now = Date.now();
    const newPaidAmount = Math.min(
      targetLoan.totalAmount,
      Number(targetLoan.paidAmount) + amount
    );
    const isNowSettled = newPaidAmount >= targetLoan.totalAmount;

    updateState((prev) => ({
      ...prev,
      accounts: prev.accounts.map((a) => {
        if (a.id !== repayAccountId || a.ownerEmail !== currentUser.email) return a;
        return {
          ...a,
          balance:
            targetLoan.loanType === 'lend'
              ? Number(a.balance) + amount
              : Number(a.balance) - amount,
          updatedAt: now,
        };
      }),
      loans: prev.loans.map((l) => {
        if (l.id !== targetLoan.id) return l;
        return {
          ...l,
          paidAmount: newPaidAmount,
          status: isNowSettled ? 'settled' : 'active',
          updatedAt: now,
          repayments: [
            ...l.repayments,
            {
              id: `rep-${now}`,
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
    const now = Date.now();
    updateState((prev) => ({
      ...prev,
      accounts: prev.accounts.map((a) =>
        a.id === accountId && a.ownerEmail === currentUser.email
          ? { ...a, isSharedWithFamily: !a.isSharedWithFamily, updatedAt: now }
          : a
      ),
    }));
    showToast('อัปเดตสถานะการแชร์บัญชีนี้แล้ว');
  };

  // ============================================================================
  // GMAIL FAMILY SHARING: INVITE, ACCEPT, PAUSE/RESUME, DISCONNECT
  // ============================================================================
  const handleSendShareInvite = (e) => {
    e.preventDefault();
    let targetEmail = inviteEmailInput.trim().toLowerCase();
    if (!targetEmail) return;
    if (!targetEmail.includes('@')) {
      targetEmail = `${targetEmail}@gmail.com`;
    }
    if (targetEmail === currentUser.email.toLowerCase()) {
      showToast('ไม่สามารถส่งคำขอแชร์หา Gmail ของตัวเองได้');
      return;
    }

    const now = Date.now();
    const existingTargetUser = appState.users.find(
      (u) => u.email.toLowerCase() === targetEmail
    );
    const targetName = existingTargetUser?.name || targetEmail.split('@')[0];

    updateState((prev) => {
      const list = Array.isArray(prev.shareConnections) ? prev.shareConnections : [];
      const existingConn = list.find(
        (c) =>
          (c.fromEmail?.toLowerCase() === currentUser.email.toLowerCase() &&
            c.toEmail?.toLowerCase() === targetEmail) ||
          (c.fromEmail?.toLowerCase() === targetEmail &&
            c.toEmail?.toLowerCase() === currentUser.email.toLowerCase())
      );

      if (existingConn) {
        return {
          ...prev,
          shareConnections: list.map((c) =>
            c.id === existingConn.id
              ? {
                  ...c,
                  fromEmail: currentUser.email.toLowerCase(),
                  fromName: currentUser.name,
                  toEmail: targetEmail,
                  toName: targetName,
                  status: c.status === 'accepted' ? 'accepted' : 'pending',
                  fromShareEnabled: true,
                  updatedAt: now,
                }
              : c
          ),
        };
      }

      const newConn = {
        id: `conn-${now}`,
        fromEmail: currentUser.email.toLowerCase(),
        fromName: currentUser.name,
        toEmail: targetEmail,
        toName: targetName,
        status: 'pending',
        fromShareEnabled: true,
        toShareEnabled: true,
        createdAt: new Date().toISOString().slice(0, 10),
        updatedAt: now,
      };

      return {
        ...prev,
        shareConnections: [newConn, ...list],
      };
    });

    setInviteEmailInput('');
    showToast(`ส่งคำขอแชร์ไปยัง ${targetEmail} แล้ว! รออีกฝ่ายกดรับ`);
  };

  const handleAcceptShareInvite = (connId) => {
    const now = Date.now();
    updateState((prev) => ({
      ...prev,
      // Ensure all my accounts have isSharedWithFamily enabled by default when accepting
      accounts: prev.accounts.map((a) =>
        a.ownerEmail === currentUser.email && a.isSharedWithFamily === undefined
          ? { ...a, isSharedWithFamily: true, updatedAt: now }
          : a
      ),
      shareConnections: (prev.shareConnections || []).map((c) =>
        c.id === connId
          ? {
              ...c,
              toName: currentUser.name,
              status: 'accepted',
              fromShareEnabled: true,
              toShareEnabled: true,
              updatedAt: now,
            }
          : c
      ),
    }));
    setViewMode('family');
    showToast('✅ กดรับการแชร์สำเร็จ! ตอนนี้ดูยอดของกันและกันในโหมดคนในบ้านได้แล้ว');
  };

  const handleDeclineShareInvite = (connId) => {
    updateState((prev) => ({
      ...prev,
      shareConnections: (prev.shareConnections || []).filter((c) => c.id !== connId),
      deletedIds: [...(prev.deletedIds || []), connId],
    }));
    showToast('ปฏิเสธคำขอแชร์แล้ว');
  };

  const handleToggleMyShareInConnection = (conn) => {
    const now = Date.now();
    const isFromMe = conn.fromEmail?.toLowerCase() === currentUser.email.toLowerCase();
    const nextEnabled = isFromMe ? !conn.fromShareEnabled : !conn.toShareEnabled;

    updateState((prev) => ({
      ...prev,
      shareConnections: (prev.shareConnections || []).map((c) => {
        if (c.id !== conn.id) return c;
        if (isFromMe) {
          return { ...c, fromShareEnabled: nextEnabled, updatedAt: now };
        }
        return { ...c, toShareEnabled: nextEnabled, updatedAt: now };
      }),
    }));

    showToast(
      nextEnabled
        ? '🟢 เปิดการแชร์ข้อมูลของฉันให้คนในบ้านเห็นแล้ว'
        : '⏸️ ปิดการแชร์ข้อมูลของฉันชั่วคราวแล้ว (อีกฝ่ายจะไม่เห็นบัญชีของคุณ)'
    );
  };

  const handleRemoveConnection = (connId) => {
    updateState((prev) => ({
      ...prev,
      shareConnections: (prev.shareConnections || []).filter((c) => c.id !== connId),
      deletedIds: [...(prev.deletedIds || []), connId],
    }));
    setFamilyMemberFilter('all');
    showToast('ยกเลิกการเชื่อมต่อแชร์กับบัญชีนี้แล้ว');
  };

  const handleManualCloudRefresh = async () => {
    showToast('⏳ กำลังซิงค์ข้อมูลระหว่าง มือถือ ↔ คอม...');
    const currentLocal = loadAppState();
    const merged = await pushStateToCloud(currentLocal);
    setAppState(merged);
    showToast('🔄 ซิงค์ข้อมูลล่าสุดระหว่าง มือถือ ↔ คอม เรียบร้อยแล้ว!');
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
            <span>🗂️</span> รวมบัญชี (3 กลุ่มหลัก)
          </button>
          <button
            type="button"
            className={`sidebar-nav-btn ${activeTab === 'transactions' ? 'active' : ''}`}
            onClick={() => setActiveTab('transactions')}
            style={{ justifyContent: 'space-between' }}
          >
            <span style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span>📝</span> รายการทั้งหมด (Transactions)
            </span>
            <span
              style={{
                background: 'rgba(255,255,255,0.14)',
                color: '#e2e8f0',
                borderRadius: 999,
                padding: '1px 8px',
                fontSize: '0.72rem',
                fontWeight: 700,
              }}
            >
              {visibleTransactions.length}
            </span>
          </button>
          <button
            type="button"
            className={`sidebar-nav-btn ${activeTab === 'accounts' ? 'active' : ''}`}
            onClick={() => setActiveTab('accounts')}
          >
            <span>💳</span> รายละเอียดบัตร & ผ่อนชำระ
          </button>
          <button
            type="button"
            className={`sidebar-nav-btn ${activeTab === 'loans' ? 'active' : ''}`}
            onClick={() => setActiveTab('loans')}
          >
            <span>🤝</span> ประวัติเจ้าหนี้ & ลูกหนี้
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
            style={{ justifyContent: 'space-between' }}
          >
            <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span>🏠</span> แชร์คนในบ้าน (Gmail)
            </span>
            {pendingIncomingInvites.length > 0 && (
              <span
                style={{
                  background: '#ec4899',
                  color: '#fff',
                  borderRadius: 999,
                  padding: '2px 8px',
                  fontSize: '0.72rem',
                  fontWeight: 800,
                }}
              >
                {pendingIncomingInvites.length} คำขอ
              </span>
            )}
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
                    ? 'มุมมองแชร์คนในบ้าน (ดูอย่างเดียวสำหรับบัญชีคนอื่น)'
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
                  ? sharedByOthersEmails.length > 0
                    ? `เชื่อมต่อแชร์กับ ${sharedByOthersEmails.join(', ')}`
                    : 'ยังไม่มีคนที่กดรับการแชร์ (กดแท็บ 🏠 คนในบ้าน เพื่อแอด Gmail)'
                  : currentUser.email}
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <div className="mode-switcher">
              <button
                type="button"
                className={`mode-btn ${viewMode === 'personal' ? 'active' : ''}`}
                onClick={() => {
                  setViewMode('personal');
                  setFamilyMemberFilter('all');
                }}
              >
                👤 ส่วนตัว
              </button>
              <button
                type="button"
                className={`mode-btn ${viewMode === 'family' ? 'active' : ''}`}
                onClick={() => setViewMode('family')}
              >
                🏠 ดูยอดคนในบ้าน {sharedByOthersEmails.length > 0 ? `(${sharedByOthersEmails.length + 1})` : ''}
              </button>
            </div>

            <button
              type="button"
              onClick={() => setActiveTab('family')}
              className="btn btn-outline btn-sm"
              style={{ position: 'relative' }}
            >
              👨‍👩‍👧‍👦 แอด Gmail คนในบ้าน
              {pendingIncomingInvites.length > 0 && (
                <span
                  style={{
                    marginLeft: 6,
                    background: '#ec4899',
                    color: '#fff',
                    borderRadius: 999,
                    padding: '1px 7px',
                    fontSize: '0.72rem',
                    fontWeight: 800,
                  }}
                >
                  {pendingIncomingInvites.length}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={handleManualCloudRefresh}
              className="btn btn-outline btn-sm"
              title="ซิงค์ข้อมูลล่าสุดระหว่างมือถือและคอมพิวเตอร์"
            >
              🔄 ซิงค์ มือถือ↔คอม
            </button>

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
          {/* GLOBAL BANNER: INCOMING GMAIL SHARE INVITATIONS (ต้องกดรับก่อน) */}
          {/* ================================================================= */}
          {pendingIncomingInvites.length > 0 && (
            <div
              style={{
                background: 'linear-gradient(135deg, #fdf2f8 0%, #fce7f3 100%)',
                border: '2px solid #ec4899',
                borderRadius: 16,
                padding: '16px 20px',
                marginBottom: 20,
                display: 'flex',
                flexDirection: 'column',
                gap: 12,
                boxShadow: '0 10px 25px -5px rgba(236, 72, 153, 0.2)',
              }}
            >
              <div style={{ fontWeight: 800, color: '#9d174d', fontSize: '1rem', display: 'flex', alignItems: 'center', gap: 8 }}>
                <span>🔔</span> มีคำขอแชร์ดูยอดบัญชีจากคนในบ้าน ({pendingIncomingInvites.length} รายการ)
              </div>
              {pendingIncomingInvites.map((inv) => (
                <div
                  key={inv.id}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    flexWrap: 'wrap',
                    gap: 10,
                    background: '#ffffff',
                    padding: '12px 16px',
                    borderRadius: 12,
                    border: '1px solid #fbcfe8',
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 800, color: '#0f172a' }}>
                      👤 {inv.fromName} ({inv.fromEmail})
                    </div>
                    <div style={{ fontSize: '0.82rem', color: '#64748b' }}>
                      ขอแชร์ยอดบัญชีให้เห็นกันและกัน (โหมด <strong>ดูอย่างเดียว</strong> แก้ไขหรือลบของกันและกันไม่ได้ และกดปิดการแชร์เมื่อไหร่ก็ได้)
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button
                      type="button"
                      onClick={() => handleAcceptShareInvite(inv.id)}
                      className="btn btn-success btn-sm"
                    >
                      ✅ กดรับการแชร์
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeclineShareInvite(inv.id)}
                      className="btn btn-outline btn-sm"
                      style={{ color: '#dc2626' }}
                    >
                      ✕ ปฏิเสธ
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* ================================================================= */}
          {/* FAMILY MEMBER FILTER BAR (WHEN IN FAMILY MODE) */}
          {/* ================================================================= */}
          {viewMode === 'family' && (
            <div
              className="card"
              style={{
                marginBottom: 20,
                padding: '14px 18px',
                background: '#fdf2f8',
                border: '1px solid #fbcfe8',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: 12,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <span style={{ fontWeight: 800, fontSize: '0.88rem', color: '#9d174d' }}>
                  👀 เลือกดูบัญชี:
                </span>
                <button
                  type="button"
                  onClick={() => setFamilyMemberFilter('all')}
                  className={`btn btn-sm ${familyMemberFilter === 'all' ? 'btn-primary' : 'btn-outline'}`}
                >
                  🏠 ยอดรวมทุกคน ({sharedByOthersEmails.length + 1} คน)
                </button>
                <button
                  type="button"
                  onClick={() => setFamilyMemberFilter(currentUser.email)}
                  className={`btn btn-sm ${
                    familyMemberFilter === currentUser.email ? 'btn-primary' : 'btn-outline'
                  }`}
                >
                  👤 ของฉัน ({currentUser.name})
                </button>
                {sharedByOthersEmails.map((em) => {
                  const uObj = appState.users.find((u) => u.email.toLowerCase() === em);
                  const connObj = acceptedConnections.find(
                    (c) => c.fromEmail?.toLowerCase() === em || c.toEmail?.toLowerCase() === em
                  );
                  const display =
                    uObj?.name ||
                    (connObj?.fromEmail?.toLowerCase() === em ? connObj?.fromName : connObj?.toName) ||
                    em.split('@')[0];
                  return (
                    <button
                      key={em}
                      type="button"
                      onClick={() => setFamilyMemberFilter(em)}
                      className={`btn btn-sm ${
                        familyMemberFilter === em ? 'btn-primary' : 'btn-outline'
                      }`}
                    >
                      👀 ของ {display} (ดูอย่างเดียว)
                    </button>
                  );
                })}
              </div>

              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  type="button"
                  onClick={handleManualCloudRefresh}
                  className="btn btn-outline btn-sm"
                >
                  🔄 อัปเดตยอดล่าสุด
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('family')}
                  className="btn btn-primary btn-sm"
                >
                  ⚙️ ตั้งค่าการแชร์ / ปิดแชร์
                </button>
              </div>
            </div>
          )}

          {/* ================================================================= */}
          {/* TAB 1: รวมบัญชี 3 กลุ่มหลัก (ที่เก็บตังค์ / ใช้ก่อนจ่าย / เจ้าหนี้-ลูกหนี้) */}
          {/* ================================================================= */}
          {activeTab === 'dashboard' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
              {/* Top Net Summary Card */}
              <div className={viewMode === 'family' ? 'hero-card-family' : 'hero-card'}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16 }}>
                  <div>
                    <div style={{ fontSize: '0.82rem', opacity: 0.9, fontWeight: 600, marginBottom: 4 }}>
                      {viewMode === 'family'
                        ? familyMemberFilter === 'all'
                          ? '🏠 ยอดสุทธิรวมของบ้าน (ที่เก็บตังค์ - ใช้ก่อนจ่าย + ลูกหนี้ - เจ้าหนี้)'
                          : `👀 ยอดสุทธิของ ${familyMemberFilter} (โหมดดูอย่างเดียว)`
                        : '💎 ยอดเงินสุทธิรวมทั้งหมด (Net Balance)'}
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
                      ＋ จดรายรับของฉัน
                    </button>
                    <button
                      type="button"
                      onClick={() => openNewTransactionModal('expense')}
                      className="btn btn-sm"
                      style={{ background: '#ffffff', color: '#1e1b4b' }}
                    >
                      💸 จดรายจ่าย / รูดบัตร
                    </button>
                  </div>
                </div>

                {/* 3 Group Summary Pills */}
                <div className="grid-3" style={{ marginTop: 20 }}>
                  <div style={{ background: 'rgba(255,255,255,0.14)', padding: 14, borderRadius: 14 }}>
                    <div style={{ fontSize: '0.78rem', opacity: 0.9 }}>1️⃣ ยอดรวม Group ที่เก็บตังค์</div>
                    <div style={{ fontSize: '1.3rem', fontWeight: 800, marginTop: 4, color: '#a7f3d0' }}>
                      {formatTHB(summary.totalAssets)}
                    </div>
                  </div>
                  <div style={{ background: 'rgba(255,255,255,0.14)', padding: 14, borderRadius: 14 }}>
                    <div style={{ fontSize: '0.78rem', opacity: 0.9 }}>2️⃣ ยอดรวม Group ใช้ก่อนจ่าย</div>
                    <div style={{ fontSize: '1.3rem', fontWeight: 800, marginTop: 4, color: '#fecdd3' }}>
                      -{formatTHB(summary.totalCreditUsed)}
                    </div>
                  </div>
                  <div style={{ background: 'rgba(255,255,255,0.14)', padding: 14, borderRadius: 14 }}>
                    <div style={{ fontSize: '0.78rem', opacity: 0.9 }}>3️⃣ ยอดรวม เจ้าหนี้ / ลูกหนี้</div>
                    <div style={{ fontSize: '1.05rem', fontWeight: 800, marginTop: 4 }}>
                      <span style={{ color: '#a7f3d0' }}>ลูกหนี้ +{formatTHB(summary.totalReceivableLoans)}</span>
                      {'  •  '}
                      <span style={{ color: '#fde68a' }}>เจ้าหนี้ -{formatTHB(summary.totalPayableLoans)}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* ============================================================= */}
              {/* GROUP 1: ที่เก็บตังค์ (เห็นยอดรวม + สร้าง/แก้ไข/ลบ ตามใจได้) */}
              {/* ============================================================= */}
              <div className="card" style={{ borderLeft: '5px solid #10b981' }}>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    flexWrap: 'wrap',
                    gap: 12,
                    paddingBottom: 14,
                    marginBottom: 16,
                    borderBottom: '1px solid #e2e8f0',
                  }}
                >
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <h2 style={{ fontSize: '1.15rem', fontWeight: 800, color: '#065f46' }}>
                        🏦 1. Group ที่เก็บตังค์
                      </h2>
                      <span className="badge badge-emerald">
                        {assetAccounts.length} บัญชี
                      </span>
                    </div>
                    <p style={{ fontSize: '0.82rem', color: '#64748b', marginTop: 2 }}>
                      เช่น BBL, KBank, Wallet, กระเป๋าเงินสด (ของตัวเองสร้าง/แก้ไข/ลบได้ • ของคนในบ้านดูอย่างเดียว)
                    </p>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600 }}>
                        ยอดรวมที่เก็บตังค์ทั้งหมด
                      </div>
                      <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#059669' }}>
                        {formatTHB(summary.totalAssets)}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => openCreateAccountModal('bank')}
                      className="btn btn-success btn-sm"
                    >
                      ＋ สร้างที่เก็บตังค์
                    </button>
                  </div>
                </div>

                {assetAccounts.length === 0 ? (
                  <div style={{ padding: 24, textAlign: 'center', color: '#64748b' }}>
                    ยังไม่มีบัญชีใน Group ที่เก็บตังค์ กดปุ่ม <strong>&ldquo;＋ สร้างที่เก็บตังค์&rdquo;</strong> เพื่อสร้าง เช่น BBL, KBank, Wallet ได้เลย
                  </div>
                ) : (
                  <div className="grid-2">
                    {assetAccounts.map((acc) => {
                      const isOwner = acc.ownerEmail === currentUser.email;
                      return (
                        <div
                          key={acc.id}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '14px 16px',
                            borderRadius: 14,
                            border: isOwner ? '1px solid #e2e8f0' : '1px dashed #cbd5e1',
                            background: isOwner ? '#f8fafc' : '#fdf2f8',
                            gap: 10,
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                            <div
                              style={{
                                width: 44,
                                height: 44,
                                borderRadius: 12,
                                background: acc.color || '#059669',
                                color: '#fff',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: '1.25rem',
                                flexShrink: 0,
                              }}
                            >
                              {ACCOUNT_TYPE_META[acc.type]?.icon || '🏦'}
                            </div>
                            <div>
                              <div style={{ fontWeight: 800, fontSize: '0.98rem', display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                                {acc.name}
                                <span className="badge badge-slate">
                                  {ACCOUNT_TYPE_META[acc.type]?.badge}
                                </span>
                                {!isOwner && (
                                  <span className="badge badge-pink">
                                    👀 ของ {acc.ownerName} (ดูอย่างเดียว)
                                  </span>
                                )}
                              </div>
                              <div style={{ fontSize: '1.15rem', fontWeight: 800, color: '#059669', marginTop: 2 }}>
                                {formatTHB(acc.balance)}
                              </div>
                            </div>
                          </div>

                          {isOwner ? (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                              <button
                                type="button"
                                onClick={() => openEditAccountModal(acc)}
                                className="btn btn-outline btn-sm"
                                title="แก้ไขชื่อหรือยอดเงิน"
                              >
                                ✏️ แก้ไข
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteAccount(acc)}
                                className="btn btn-outline btn-sm"
                                style={{ color: '#dc2626' }}
                                title="ลบบัญชีนี้"
                              >
                                🗑️ ลบ
                              </button>
                            </div>
                          ) : (
                            <span style={{ fontSize: '0.76rem', color: '#9d174d', fontWeight: 700 }}>
                              🔒 เห็นอย่างเดียว
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* ============================================================= */}
              {/* GROUP 2: ใช้ก่อนจ่ายทีหลัง (เห็นยอดรวม + สร้าง/แก้ไข/ลบ ตามใจได้) */}
              {/* ============================================================= */}
              <div className="card" style={{ borderLeft: '5px solid #4f46e5' }}>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    flexWrap: 'wrap',
                    gap: 12,
                    paddingBottom: 14,
                    marginBottom: 16,
                    borderBottom: '1px solid #e2e8f0',
                  }}
                >
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <h2 style={{ fontSize: '1.15rem', fontWeight: 800, color: '#312e81' }}>
                        💳 2. Group ใช้ก่อนจ่าย (บัตรเครดิต & PayLater)
                      </h2>
                      <span className="badge badge-indigo">
                        {creditAccounts.length} รายการ
                      </span>
                    </div>
                    <p style={{ fontSize: '0.82rem', color: '#64748b', marginTop: 2 }}>
                      เช่น บัตรเครดิต BBL, KBank, KTC, SPayLater (ของตัวเองสร้าง/แก้ไข/ลบได้ • ของคนในบ้านดูอย่างเดียว)
                    </p>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600 }}>
                        ยอดรวมใช้ก่อนจ่ายทั้งหมด (วงเงินเหลือ {formatTHB(Math.max(0, summary.totalCreditLimit - summary.totalCreditUsed))})
                      </div>
                      <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#dc2626' }}>
                        -{formatTHB(summary.totalCreditUsed)}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => openCreateAccountModal('credit_card')}
                      className="btn btn-primary btn-sm"
                    >
                      ＋ สร้างบัตร / ใช้ก่อนจ่าย
                    </button>
                  </div>
                </div>

                {creditAccounts.length === 0 ? (
                  <div style={{ padding: 24, textAlign: 'center', color: '#64748b' }}>
                    ยังไม่มีรายการใน Group ใช้ก่อนจ่าย กดปุ่ม <strong>&ldquo;＋ สร้างบัตร / ใช้ก่อนจ่าย&rdquo;</strong> เพื่อเพิ่มบัตรเครดิต BBL, KBank หรือ PayLater ได้เลย
                  </div>
                ) : (
                  <div className="grid-2">
                    {creditAccounts.map((card) => {
                      const isOwner = card.ownerEmail === currentUser.email;
                      const available = Math.max(0, Number(card.creditLimit) - Number(card.usedAmount));
                      const usagePct =
                        card.creditLimit > 0
                          ? Math.min(100, Math.round((card.usedAmount / card.creditLimit) * 100))
                          : 0;
                      return (
                        <div
                          key={card.id}
                          style={{
                            padding: 16,
                            borderRadius: 14,
                            border: isOwner ? '1px solid #e2e8f0' : '1px dashed #cbd5e1',
                            background: isOwner ? '#f8fafc' : '#fdf2f8',
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8, marginBottom: 10 }}>
                            <div>
                              <div style={{ fontWeight: 800, fontSize: '0.98rem', display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                                <span>{ACCOUNT_TYPE_META[card.type]?.icon}</span>
                                {card.name}
                                <span className="badge badge-indigo">
                                  {ACCOUNT_TYPE_META[card.type]?.badge}
                                </span>
                                {!isOwner && (
                                  <span className="badge badge-pink">
                                    👀 ของ {card.ownerName} (ดูอย่างเดียว)
                                  </span>
                                )}
                              </div>
                              <div style={{ fontSize: '1.15rem', fontWeight: 800, color: '#dc2626', marginTop: 2 }}>
                                ยอดใช้ไป: {formatTHB(card.usedAmount)}
                              </div>
                              <div style={{ fontSize: '0.78rem', color: '#64748b' }}>
                                วงเงินเหลือ: <strong style={{ color: '#059669' }}>{formatTHB(available)}</strong> (จาก {formatTHB(card.creditLimit)}) • สรุปวันที่ {card.statementDay} / จ่ายวันที่ {card.dueDay}
                              </div>
                            </div>

                            {isOwner ? (
                              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setShowPayCardModal(card);
                                    setPayCardAmount(String(card.usedAmount));
                                    setPayCardFromAccId(myAssetAccounts[0]?.id || '');
                                  }}
                                  className="btn btn-primary btn-sm"
                                >
                                  จ่ายบิล
                                </button>
                                <button
                                  type="button"
                                  onClick={() => openEditAccountModal(card)}
                                  className="btn btn-outline btn-sm"
                                >
                                  ✏️ แก้ไข
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDeleteAccount(card)}
                                  className="btn btn-outline btn-sm"
                                  style={{ color: '#dc2626' }}
                                >
                                  🗑️ ลบ
                                </button>
                              </div>
                            ) : (
                              <span style={{ fontSize: '0.76rem', color: '#9d174d', fontWeight: 700 }}>
                                🔒 เห็นอย่างเดียว
                              </span>
                            )}
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

              {/* ============================================================= */}
              {/* GROUP 3: เจ้าหนี้ & ลูกหนี้ (เห็นยอดรวม + สร้าง/แก้ไข/ลบ ตามใจได้) */}
              {/* ============================================================= */}
              <div className="card" style={{ borderLeft: '5px solid #f59e0b' }}>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    flexWrap: 'wrap',
                    gap: 12,
                    paddingBottom: 14,
                    marginBottom: 16,
                    borderBottom: '1px solid #e2e8f0',
                  }}
                >
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <h2 style={{ fontSize: '1.15rem', fontWeight: 800, color: '#92400e' }}>
                        🤝 3. Group เจ้าหนี้ & ลูกหนี้
                      </h2>
                      <span className="badge badge-amber">
                        {visibleLoans.length} รายชื่อ
                      </span>
                    </div>
                    <p style={{ fontSize: '0.82rem', color: '#64748b', marginTop: 2 }}>
                      เช่น นายหนึ่ง, นางสอง (ของตัวเองสร้าง/แก้ไข/ลบได้ • ของคนในบ้านดูอย่างเดียว)
                    </p>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600 }}>
                        ยอดรวมลูกหนี้ (รอรับคืน) / เจ้าหนี้ (ต้องจ่ายคืน)
                      </div>
                      <div style={{ fontSize: '1.15rem', fontWeight: 800 }}>
                        <span style={{ color: '#059669' }}>ลูกหนี้ +{formatTHB(summary.totalReceivableLoans)}</span>
                        {'  |  '}
                        <span style={{ color: '#dc2626' }}>เจ้าหนี้ -{formatTHB(summary.totalPayableLoans)}</span>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={openCreateLoanModal}
                      className="btn btn-primary btn-sm"
                    >
                      ＋ สร้างเจ้าหนี้ / ลูกหนี้
                    </button>
                  </div>
                </div>

                {visibleLoans.length === 0 ? (
                  <div style={{ padding: 24, textAlign: 'center', color: '#64748b' }}>
                    ยังไม่มีรายชื่อใน Group เจ้าหนี้ / ลูกหนี้ กดปุ่ม <strong>&ldquo;＋ สร้างเจ้าหนี้ / ลูกหนี้&rdquo;</strong> เพื่อเพิ่ม เช่น นายหนึ่ง, นางสอง ได้เลย
                  </div>
                ) : (
                  <div className="grid-2">
                    {visibleLoans.map((loan) => {
                      const isOwner = loan.ownerEmail === currentUser.email;
                      const remaining = Math.max(0, Number(loan.totalAmount) - Number(loan.paidAmount));
                      const isLend = loan.loanType === 'lend';
                      return (
                        <div
                          key={loan.id}
                          style={{
                            padding: 16,
                            borderRadius: 14,
                            border: isLend ? '1px solid #a7f3d0' : '1px solid #fde68a',
                            background: isLend ? '#ecfdf5' : '#fffbeb',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            gap: 10,
                            flexWrap: 'wrap',
                          }}
                        >
                          <div>
                            <div style={{ fontWeight: 800, fontSize: '0.98rem', display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                              <span>👤 {loan.personName}</span>
                              <span className={`badge ${isLend ? 'badge-emerald' : 'badge-amber'}`}>
                                {isLend ? '🟢 ลูกหนี้ (ให้ยืม)' : '🟠 เจ้าหนี้ (ยืมมา)'}
                              </span>
                              {!isOwner && (
                                <span className="badge badge-pink">
                                  👀 ของ {loan.ownerName} (ดูอย่างเดียว)
                                </span>
                              )}
                            </div>
                            <div
                              style={{
                                fontSize: '1.15rem',
                                fontWeight: 800,
                                color: isLend ? '#059669' : '#dc2626',
                                marginTop: 2,
                              }}
                            >
                              {loan.status === 'settled'
                                ? '✅ เคลียร์ครบแล้ว (0 บาท)'
                                : `ยอดคงเหลือ: ${formatTHB(remaining)}`}
                            </div>
                            <div style={{ fontSize: '0.78rem', color: '#475569' }}>
                              ยอดตั้งต้น {formatTHB(loan.totalAmount)} • จ่ายแล้ว {formatTHB(loan.paidAmount)} • {loan.note || '-'}
                            </div>
                          </div>

                          {isOwner ? (
                            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                              {loan.status === 'active' && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setShowRepayLoanModal(loan);
                                    setRepayAmount(String(remaining));
                                    setRepayAccountId(myAssetAccounts[0]?.id || loan.accountId);
                                  }}
                                  className="btn btn-success btn-sm"
                                >
                                  {isLend ? 'รับเงินคืน' : 'จ่ายคืน'}
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => openEditLoanModal(loan)}
                                className="btn btn-outline btn-sm"
                              >
                                ✏️ แก้ไข
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteLoan(loan)}
                                className="btn btn-outline btn-sm"
                                style={{ color: '#dc2626' }}
                              >
                                🗑️ ลบ
                              </button>
                            </div>
                          ) : (
                            <span style={{ fontSize: '0.76rem', color: '#9d174d', fontWeight: 700 }}>
                              🔒 เห็นอย่างเดียว
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Recent Transactions List */}
              <div className="card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, flexWrap: 'wrap', gap: 10 }}>
                  <div>
                    <h2 style={{ fontSize: '1.05rem', fontWeight: 800 }}>
                      📝 รายการรับ-จ่ายล่าสุด ({Math.min(visibleTransactions.length, 20)} จาก {visibleTransactions.length} รายการ)
                    </h2>
                    <p style={{ fontSize: '0.8rem', color: '#64748b' }}>
                      รายการของคุณกด ✏️ แก้ไขหรือลบได้ • รายการของคนในบ้านแสดงแบบดูอย่างเดียว
                    </p>
                  </div>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <button
                      type="button"
                      onClick={() => setActiveTab('transactions')}
                      className="btn btn-outline btn-sm"
                    >
                      🔍 ดูรายการทั้งหมด ({visibleTransactions.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => openNewTransactionModal('expense')}
                      className="btn btn-primary btn-sm"
                    >
                      ＋ เพิ่มรายการรับ-จ่าย
                    </button>
                  </div>
                </div>

                {visibleTransactions.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: 28, color: '#64748b' }}>
                    ยังไม่มีรายการบันทึก กดปุ่ม &ldquo;＋ เพิ่มรายการรับ-จ่าย&rdquo; เพื่อเริ่มต้นได้เลย
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {visibleTransactions.slice(0, 20).map((tx) => {
                      const isOwner = tx.ownerEmail === currentUser.email;
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
                            background: isOwner ? '#f8fafc' : '#fdf2f8',
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
                                {!isOwner && (
                                  <span className="badge badge-pink">
                                    👀 ของ {tx.ownerName}
                                  </span>
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
                            {isOwner && (
                              <button
                                type="button"
                                onClick={() => openEditTransactionModal(tx)}
                                className="btn btn-outline btn-sm"
                                style={{ padding: '4px 8px' }}
                                title="แก้ไขหรือลบรายการนี้"
                              >
                                ✏️
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                    {visibleTransactions.length > 20 && (
                      <button
                        type="button"
                        onClick={() => setActiveTab('transactions')}
                        className="btn btn-outline"
                        style={{ width: '100%', marginTop: 4 }}
                      >
                        📋 ดูรายการทั้งหมดครบทั้ง {visibleTransactions.length} รายการ →
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ================================================================= */}
          {/* TAB 1.5: ALL TRANSACTIONS (หน้าดูรายการทั้งหมด + ค้นหา + กรอง) */}
          {/* ================================================================= */}
          {activeTab === 'transactions' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
                <div>
                  <h1 style={{ fontSize: '1.35rem', fontWeight: 800 }}>
                    📝 รายการรับ-จ่าย-โอนทั้งหมด ({filteredAllTransactions.length} รายการ)
                  </h1>
                  <p style={{ fontSize: '0.86rem', color: '#64748b' }}>
                    ดูประวัติธุรกรรมทั้งหมด ค้นหาตามชื่อ/ยอดเงิน กรองตามบัญชี หมวดหมู่ หรือเดือน และกด ✏️ แก้ไขรายการของคุณได้ทันที
                  </p>
                </div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    onClick={handleExportCSV}
                    className="btn btn-outline btn-sm"
                  >
                    📥 ส่งออก Excel (CSV)
                  </button>
                  <button
                    type="button"
                    onClick={() => openNewTransactionModal('expense')}
                    className="btn btn-primary btn-sm"
                  >
                    ＋ เพิ่มรายการใหม่
                  </button>
                </div>
              </div>

              {/* Summary Strip for Filtered Transactions */}
              <div className="grid-3">
                <div className="card" style={{ padding: '16px 18px', borderLeft: '4px solid #10b981' }}>
                  <div style={{ fontSize: '0.78rem', color: '#64748b', fontWeight: 600 }}>
                    รายรับรวม (จากรายการที่กรอง)
                  </div>
                  <div style={{ fontSize: '1.35rem', fontWeight: 800, color: '#059669', marginTop: 4 }}>
                    +{formatTHB(
                      filteredAllTransactions
                        .filter((t) => t.type === 'income')
                        .reduce((s, t) => s + Number(t.amount || 0), 0)
                    )}
                  </div>
                </div>
                <div className="card" style={{ padding: '16px 18px', borderLeft: '4px solid #ef4444' }}>
                  <div style={{ fontSize: '0.78rem', color: '#64748b', fontWeight: 600 }}>
                    รายจ่ายรวม (จากรายการที่กรอง)
                  </div>
                  <div style={{ fontSize: '1.35rem', fontWeight: 800, color: '#dc2626', marginTop: 4 }}>
                    -{formatTHB(
                      filteredAllTransactions
                        .filter((t) => t.type === 'expense')
                        .reduce((s, t) => s + Number(t.amount || 0), 0)
                    )}
                  </div>
                </div>
                <div className="card" style={{ padding: '16px 18px', borderLeft: '4px solid #4f46e5' }}>
                  <div style={{ fontSize: '0.78rem', color: '#64748b', fontWeight: 600 }}>
                    โอนเงิน / จ่ายบิลบัตร (จากรายการที่กรอง)
                  </div>
                  <div style={{ fontSize: '1.35rem', fontWeight: 800, color: '#4f46e5', marginTop: 4 }}>
                    {formatTHB(
                      filteredAllTransactions
                        .filter((t) => t.type === 'transfer' || t.type === 'card_payment')
                        .reduce((s, t) => s + Number(t.amount || 0), 0)
                    )}
                  </div>
                </div>
              </div>

              {/* Search & Filter Controls Card */}
              <div className="card" style={{ padding: 18 }}>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
                  {[
                    { id: 'all', label: `📋 ทั้งหมด (${visibleTransactions.length})` },
                    { id: 'expense', label: '💸 รายจ่าย' },
                    { id: 'income', label: '💰 รายรับ' },
                    { id: 'transfer_or_card', label: '🔄 โอนเงิน / จ่ายบัตร' },
                  ].map((tab) => (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setTxFilterType(tab.id)}
                      className={`btn btn-sm ${
                        txFilterType === tab.id ? 'btn-primary' : 'btn-outline'
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                  {(txFilterType !== 'all' ||
                    txFilterAccountId !== 'all' ||
                    txFilterCategory !== 'all' ||
                    txFilterMonth !== 'all' ||
                    txSearchQuery.trim() !== '') && (
                    <button
                      type="button"
                      onClick={() => {
                        setTxFilterType('all');
                        setTxFilterAccountId('all');
                        setTxFilterCategory('all');
                        setTxFilterMonth('all');
                        setTxSearchQuery('');
                      }}
                      className="btn btn-ghost btn-sm"
                      style={{ color: '#dc2626', fontWeight: 700 }}
                    >
                      ✕ ล้างตัวกรองทั้งหมด
                    </button>
                  )}
                </div>

                <div className="grid-4">
                  <div>
                    <label className="form-label" style={{ fontSize: '0.78rem' }}>
                      🔍 ค้นหาชื่อรายการ / ยอดเงิน / คนจด
                    </label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="พิมพ์คำค้นหา เช่น กาแฟ, 500..."
                      value={txSearchQuery}
                      onChange={(e) => setTxSearchQuery(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="form-label" style={{ fontSize: '0.78rem' }}>
                      🏦 กรองตามบัญชี / บัตร
                    </label>
                    <select
                      className="form-select"
                      value={txFilterAccountId}
                      onChange={(e) => setTxFilterAccountId(e.target.value)}
                    >
                      <option value="all">ทุกบัญชีและบัตร ({visibleAccounts.length})</option>
                      {visibleAccounts.map((acc) => (
                        <option key={acc.id} value={acc.id}>
                          {ACCOUNT_TYPE_META[acc.type]?.icon} {acc.name} ({acc.ownerName})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="form-label" style={{ fontSize: '0.78rem' }}>
                      🏷️ กรองตามหมวดหมู่
                    </label>
                    <select
                      className="form-select"
                      value={txFilterCategory}
                      onChange={(e) => setTxFilterCategory(e.target.value)}
                    >
                      <option value="all">ทุกหมวดหมู่</option>
                      {[...EXPENSE_CATEGORIES, ...INCOME_CATEGORIES].map((cat) => (
                        <option key={cat.id} value={cat.id}>
                          {cat.icon} {cat.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="form-label" style={{ fontSize: '0.78rem' }}>
                      📅 กรองตามเดือน (ปี-เดือน)
                    </label>
                    <select
                      className="form-select"
                      value={txFilterMonth}
                      onChange={(e) => setTxFilterMonth(e.target.value)}
                    >
                      <option value="all">ทุกเดือน</option>
                      {availableTxMonths.map((m) => (
                        <option key={m} value={m}>
                          เดือน {m}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* Complete Transactions List */}
              <div className="card">
                {filteredAllTransactions.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: 36, color: '#64748b' }}>
                    ไม่พบรายการที่ตรงกับเงื่อนไข หรือยังไม่มีรายการบันทึก
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {filteredAllTransactions.map((tx) => {
                      const isOwner = tx.ownerEmail === currentUser.email;
                      const allCats = [...EXPENSE_CATEGORIES, ...INCOME_CATEGORIES];
                      const cat = allCats.find((c) => c.id === tx.category) || {
                        icon: tx.type === 'card_payment' ? '💳' : '🔄',
                        label: tx.type === 'card_payment' ? 'จ่ายบิลบัตรเครดิต' : 'โอนเงิน',
                      };
                      const acc = appState.accounts.find((a) => a.id === tx.accountId);
                      const toAcc = tx.toAccountId
                        ? appState.accounts.find((a) => a.id === tx.toAccountId)
                        : null;
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
                            background: isOwner ? '#f8fafc' : '#fdf2f8',
                            gap: 10,
                            flexWrap: 'wrap',
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
                                {!isOwner && (
                                  <span className="badge badge-pink">
                                    👀 ของ {tx.ownerName}
                                  </span>
                                )}
                              </div>
                              <div style={{ fontSize: '0.76rem', color: '#64748b' }}>
                                {cat.label} • {acc?.name || 'บัญชี'}
                                {toAcc ? ` → ${toAcc.name}` : ''} • โดย {tx.ownerName} • วันที่ {tx.txDate}
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
                            {isOwner ? (
                              <button
                                type="button"
                                onClick={() => openEditTransactionModal(tx)}
                                className="btn btn-outline btn-sm"
                                style={{ padding: '4px 8px' }}
                                title="แก้ไขหรือลบรายการนี้"
                              >
                                ✏️
                              </button>
                            ) : (
                              <span style={{ fontSize: '0.72rem', color: '#9d174d', fontWeight: 700 }}>
                                🔒 ดูอย่างเดียว
                              </span>
                            )}
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
                    บัญชีของคุณกด ✏️ แก้ไขหรือลบได้ • บัญชีของคนในบ้านแสดงแบบดูอย่างเดียว
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
                      const isOwner = card.ownerEmail === currentUser.email;
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
                              {isOwner ? (
                                <div style={{ display: 'flex', gap: 6 }}>
                                  <button
                                    type="button"
                                    onClick={() => handleToggleAccountShare(card.id)}
                                    className="badge"
                                    style={{
                                      background: card.isSharedWithFamily !== false ? '#ec4899' : 'rgba(255,255,255,0.15)',
                                      color: '#fff',
                                      border: 'none',
                                      cursor: 'pointer',
                                    }}
                                  >
                                    {card.isSharedWithFamily !== false ? '🏠 แชร์บ้าน' : '🔒 ซ่อนส่วนตัว'}
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
                              ) : (
                                <span className="badge" style={{ background: '#ec4899', color: '#fff' }}>
                                  👀 ของ {card.ownerName} (ดูอย่างเดียว)
                                </span>
                              )}
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
                              {isOwner && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setShowPayCardModal(card);
                                    setPayCardAmount(String(card.usedAmount));
                                    setPayCardFromAccId(myAssetAccounts[0]?.id || '');
                                  }}
                                  className="btn btn-sm"
                                  style={{ background: '#ffffff', color: '#0f172a', fontWeight: 700 }}
                                >
                                  💳 โอนจ่ายบิลบัตร
                                </button>
                              )}
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
                      ติดตามยอดผ่อน 0% หรือผ่อนของผ่านบัตรเครดิต/PayLater
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
                      const isOwner = inst.ownerEmail === currentUser.email;
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
                            background: isOwner ? '#f8fafc' : '#fdf2f8',
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8, gap: 8 }}>
                            <div>
                              <div style={{ fontWeight: 700, fontSize: '0.95rem', display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                                {inst.title}
                                {!isOwner && (
                                  <span className="badge badge-pink">👀 ของ {inst.ownerName}</span>
                                )}
                              </div>
                              <div style={{ fontSize: '0.78rem', color: '#64748b' }}>
                                บัตร: {card?.name || '-'} • ผ่อนเดือนละ{' '}
                                <strong style={{ color: '#4f46e5' }}>{formatTHB(inst.monthlyAmount)}</strong>
                              </div>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                              <span className="badge badge-indigo">
                                งวด {inst.paidMonths}/{inst.totalMonths}
                              </span>
                              {isOwner && (
                                <button
                                  type="button"
                                  onClick={() => openEditInstallmentModal(inst)}
                                  className="btn btn-outline btn-sm"
                                  style={{ padding: '3px 8px' }}
                                >
                                  ✏️
                                </button>
                              )}
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
                            {isOwner && inst.paidMonths < inst.totalMonths && (
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
                  {assetAccounts.map((acc) => {
                    const isOwner = acc.ownerEmail === currentUser.email;
                    return (
                      <div
                        key={acc.id}
                        style={{
                          padding: 16,
                          borderRadius: 16,
                          border: '1px solid #e2e8f0',
                          background: isOwner ? '#ffffff' : '#fdf2f8',
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
                          {isOwner ? (
                            <div style={{ display: 'flex', gap: 6 }}>
                              <button
                                type="button"
                                onClick={() => handleToggleAccountShare(acc.id)}
                                className={`badge ${acc.isSharedWithFamily !== false ? 'badge-pink' : 'badge-slate'}`}
                                style={{ border: 'none', cursor: 'pointer' }}
                              >
                                {acc.isSharedWithFamily !== false ? '🏠 แชร์บ้าน' : '🔒 ซ่อนส่วนตัว'}
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
                          ) : (
                            <span className="badge badge-pink">👀 ของ {acc.ownerName}</span>
                          )}
                        </div>
                        <div>
                          <div style={{ fontWeight: 700, fontSize: '1rem' }}>{acc.name}</div>
                          <div style={{ fontSize: '0.76rem', color: '#64748b' }}>โดย {acc.ownerName}</div>
                        </div>
                        <div style={{ fontSize: '1.35rem', fontWeight: 800, color: '#059669' }}>
                          {formatTHB(acc.balance)}
                        </div>
                      </div>
                    );
                  })}
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
                    รายการของคุณกด ✏️ แก้ไขได้ • รายการของคนในบ้านแสดงแบบดูอย่างเดียว
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
                      🟢 ลูกหนี้ (ให้คนอื่นยืม - รอรับคืน)
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
                          const isOwner = loan.ownerEmail === currentUser.email;
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
                                    {!isOwner && (
                                      <span className="badge badge-pink">👀 ของ {loan.ownerName}</span>
                                    )}
                                  </div>
                                  <div style={{ fontSize: '0.8rem', color: '#475569', marginTop: 2 }}>
                                    {loan.note} • นัดคืน: {loan.dueDate || '-'}
                                  </div>
                                </div>
                                {isOwner ? (
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
                                          setRepayAccountId(myAssetAccounts[0]?.id || loan.accountId);
                                        }}
                                        className="btn btn-success btn-sm"
                                      >
                                        รับเงินคืน
                                      </button>
                                    )}
                                  </div>
                                ) : (
                                  <span style={{ fontSize: '0.76rem', color: '#9d174d', fontWeight: 700 }}>
                                    🔒 ดูอย่างเดียว
                                  </span>
                                )}
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
                      🟠 เจ้าหนี้ (ยืมคนอื่นมา - ต้องจ่ายคืน)
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
                          const isOwner = loan.ownerEmail === currentUser.email;
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
                                    {!isOwner && (
                                      <span className="badge badge-pink">👀 ของ {loan.ownerName}</span>
                                    )}
                                  </div>
                                  <div style={{ fontSize: '0.8rem', color: '#475569', marginTop: 2 }}>
                                    {loan.note} • กำหนดคืน: {loan.dueDate || '-'}
                                  </div>
                                </div>
                                {isOwner ? (
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
                                          setRepayAccountId(myAssetAccounts[0]?.id || loan.accountId);
                                        }}
                                        className="btn btn-primary btn-sm"
                                      >
                                        โอนจ่ายคืน
                                      </button>
                                    )}
                                  </div>
                                ) : (
                                  <span style={{ fontSize: '0.76rem', color: '#9d174d', fontWeight: 700 }}>
                                    🔒 ดูอย่างเดียว
                                  </span>
                                )}
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
          {/* TAB 5: GMAIL CONSENT-BASED FAMILY SHARING */}
          {/* ================================================================= */}
          {activeTab === 'family' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
                <div>
                  <h1 style={{ fontSize: '1.35rem', fontWeight: 800 }}>
                    🏠 แอด Gmail คนในบ้านเพื่อดูยอดกันและกัน (เห็นอย่างเดียว)
                  </h1>
                  <p style={{ fontSize: '0.86rem', color: '#64748b' }}>
                    1. พิมพ์ Gmail คนในบ้านเพื่อส่งคำขอ • 2. อีกคนต้องกดรับก่อนถึงจะเห็นกัน • 3. กดปิดการแชร์เมื่อไหร่ก็ได้ และเห็นอย่างเดียวแก้ไขของกันไม่ได้
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleManualCloudRefresh}
                  className="btn btn-outline btn-sm"
                >
                  🔄 ซิงค์สถานะคำขอล่าสุด
                </button>
              </div>

              <div className="grid-2">
                {/* LEFT CARD: ADD GMAIL & MANAGE CONNECTIONS */}
                <div className="card" style={{ borderTop: '4px solid #4f46e5' }}>
                  <h2 style={{ fontSize: '1.08rem', fontWeight: 800, marginBottom: 8 }}>
                    ➕ 1. เพิ่ม Gmail คนในบ้าน
                  </h2>
                  <p style={{ fontSize: '0.82rem', color: '#64748b', marginBottom: 14 }}>
                    กรอกอีเมล Gmail ของคนในบ้าน เมื่อเขาล็อกอินด้วย Gmail นั้น ระบบจะขึ้นปุ่มให้เขากดรับการแชร์ทันที
                  </p>

                  <form onSubmit={handleSendShareInvite} style={{ marginBottom: 22 }}>
                    <div className="form-group">
                      <label className="form-label">Gmail ของคนในบ้านที่ต้องการแชร์ด้วย</label>
                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                        <input
                          type="text"
                          className="form-input"
                          style={{ flex: 1, minWidth: 200 }}
                          placeholder="เช่น partner@gmail.com"
                          value={inviteEmailInput}
                          onChange={(e) => setInviteEmailInput(e.target.value)}
                          required
                        />
                        <button type="submit" className="btn btn-primary">
                          📨 ส่งคำขอแชร์
                        </button>
                      </div>
                    </div>
                  </form>

                  {/* Incoming Pending Invites */}
                  {pendingIncomingInvites.length > 0 && (
                    <div style={{ marginBottom: 20 }}>
                      <div style={{ fontSize: '0.9rem', fontWeight: 800, color: '#9d174d', marginBottom: 8 }}>
                        🔔 คำขอแชร์ที่รอคุณกดรับ ({pendingIncomingInvites.length}):
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                        {pendingIncomingInvites.map((inv) => (
                          <div
                            key={inv.id}
                            style={{
                              padding: 14,
                              borderRadius: 12,
                              background: '#fdf2f8',
                              border: '1px solid #f472b6',
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                              flexWrap: 'wrap',
                              gap: 10,
                            }}
                          >
                            <div>
                              <div style={{ fontWeight: 800 }}>{inv.fromName}</div>
                              <div style={{ fontSize: '0.8rem', color: '#64748b' }}>{inv.fromEmail}</div>
                            </div>
                            <div style={{ display: 'flex', gap: 8 }}>
                              <button
                                type="button"
                                onClick={() => handleAcceptShareInvite(inv.id)}
                                className="btn btn-success btn-sm"
                              >
                                ✅ กดรับการแชร์
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeclineShareInvite(inv.id)}
                                className="btn btn-outline btn-sm"
                                style={{ color: '#dc2626' }}
                              >
                                ✕ ปฏิเสธ
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Outgoing Pending Invites */}
                  {pendingOutgoingInvites.length > 0 && (
                    <div style={{ marginBottom: 20 }}>
                      <div style={{ fontSize: '0.88rem', fontWeight: 700, color: '#475569', marginBottom: 8 }}>
                        ⏳ คำขอที่ส่งไปแล้ว (รออีกฝ่ายล็อกอินมากดรับ):
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {pendingOutgoingInvites.map((inv) => (
                          <div
                            key={inv.id}
                            style={{
                              padding: '10px 14px',
                              borderRadius: 12,
                              background: '#f8fafc',
                              border: '1px dashed #cbd5e1',
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                              gap: 8,
                            }}
                          >
                            <div>
                              <div style={{ fontWeight: 700, fontSize: '0.9rem' }}>{inv.toEmail}</div>
                              <div style={{ fontSize: '0.76rem', color: '#f59e0b', fontWeight: 600 }}>
                                ⏳ รอเจ้าตัวกดรับการแชร์
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={() => handleRemoveConnection(inv.id)}
                              className="btn btn-outline btn-sm"
                              style={{ color: '#dc2626' }}
                            >
                              ยกเลิกคำขอ
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Active / Accepted Family Connections */}
                  <div>
                    <div style={{ fontSize: '0.95rem', fontWeight: 800, marginBottom: 10 }}>
                      🤝 คนในบ้านที่เชื่อมต่อกันแล้ว ({acceptedConnections.length} คน):
                    </div>
                    {acceptedConnections.length === 0 ? (
                      <div
                        style={{
                          padding: 20,
                          borderRadius: 12,
                          background: '#f8fafc',
                          border: '1px solid #e2e8f0',
                          textAlign: 'center',
                          color: '#64748b',
                          fontSize: '0.85rem',
                        }}
                      >
                        ยังไม่มีบัญชีที่เชื่อมต่อสำเร็จ ส่งคำขอด้วย Gmail ด้านบนได้เลย
                      </div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                        {acceptedConnections.map((conn) => {
                          const isFromMe =
                            conn.fromEmail?.toLowerCase() === currentUser.email.toLowerCase();
                          const partnerEmail = isFromMe ? conn.toEmail : conn.fromEmail;
                          const partnerName = isFromMe ? conn.toName : conn.fromName;
                          const myShareOn = isFromMe
                            ? conn.fromShareEnabled !== false
                            : conn.toShareEnabled !== false;
                          const partnerShareOn = isFromMe
                            ? conn.toShareEnabled !== false
                            : conn.fromShareEnabled !== false;

                          return (
                            <div
                              key={conn.id}
                              style={{
                                padding: 16,
                                borderRadius: 14,
                                border: '1px solid #cbd5e1',
                                background: '#f8fafc',
                                display: 'flex',
                                flexDirection: 'column',
                                gap: 12,
                              }}
                            >
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8, flexWrap: 'wrap' }}>
                                <div>
                                  <div style={{ fontWeight: 800, fontSize: '0.98rem', display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                                    <span>👤 {partnerName || partnerEmail}</span>
                                    <span className="badge badge-emerald">✅ กดรับแล้ว</span>
                                  </div>
                                  <div style={{ fontSize: '0.8rem', color: '#475569' }}>{partnerEmail}</div>
                                  <div style={{ fontSize: '0.78rem', marginTop: 4 }}>
                                    • สถานะฝั่งเขา:{' '}
                                    {partnerShareOn ? (
                                      <strong style={{ color: '#059669' }}>🟢 เปิดให้คุณดูยอดได้ (เห็นอย่างเดียว)</strong>
                                    ) : (
                                      <strong style={{ color: '#dc2626' }}>⏸️ เขาปิดการแชร์ชั่วคราว</strong>
                                    )}
                                  </div>
                                </div>

                                {partnerShareOn && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setViewMode('family');
                                      setFamilyMemberFilter(partnerEmail.toLowerCase());
                                      setActiveTab('dashboard');
                                    }}
                                    className="btn btn-primary btn-sm"
                                  >
                                    👀 ดูยอดของ {partnerName || partnerEmail.split('@')[0]}
                                  </button>
                                )}
                              </div>

                              <div
                                style={{
                                  display: 'flex',
                                  justifyContent: 'space-between',
                                  alignItems: 'center',
                                  paddingTop: 10,
                                  borderTop: '1px solid #e2e8f0',
                                  flexWrap: 'wrap',
                                  gap: 8,
                                }}
                              >
                                <button
                                  type="button"
                                  onClick={() => handleToggleMyShareInConnection(conn)}
                                  className={`btn btn-sm ${myShareOn ? 'btn-success' : 'btn-outline'}`}
                                >
                                  {myShareOn
                                    ? '🟢 แชร์ยอดของฉันอยู่ (กดเพื่อปิดการแชร์)'
                                    : '⏸️ ปิดการแชร์ของฉันอยู่ (กดเพื่อเปิดแชร์)'}
                                </button>

                                <button
                                  type="button"
                                  onClick={() => handleRemoveConnection(conn.id)}
                                  className="btn btn-outline btn-sm"
                                  style={{ color: '#dc2626' }}
                                >
                                  🗑️ ยกเลิกเชื่อมต่อถาวร
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>

                {/* RIGHT CARD: PRIVACY TOGGLE FOR EACH OF MY ACCOUNTS */}
                <div className="card" style={{ borderTop: '4px solid #ec4899' }}>
                  <h2 style={{ fontSize: '1.08rem', fontWeight: 800, marginBottom: 6 }}>
                    🔒 2. เลือกบัญชีของฉันที่จะให้คนในบ้านเห็น ({currentUser.email})
                  </h2>
                  <p style={{ fontSize: '0.82rem', color: '#64748b', marginBottom: 14 }}>
                    เลือกเปิด <strong>&ldquo;🏠 แชร์ให้เห็น&rdquo;</strong> หรือกด <strong>&ldquo;🔒 ซ่อนส่วนตัว&rdquo;</strong> แยกแต่ละบัญชีได้ตามใจ (คนในบ้านจะเห็นยอดอย่างเดียว แก้ไขหรือลบไม่ได้)
                  </p>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {myAccounts.map((acc) => (
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
                              ? `ยอดใช้ไป: ${formatTHB(acc.usedAmount)}`
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
                              acc.isSharedWithFamily !== false ? 'btn-primary' : 'btn-outline'
                            }`}
                          >
                            {acc.isSharedWithFamily !== false ? '🏠 แชร์ให้เห็น' : '🔒 ซ่อนส่วนตัว'}
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
          <span style={{ fontSize: '1.15rem' }}>🗂️</span>
          <span>รวมบัญชี</span>
        </button>
        <button
          type="button"
          className={`mobile-nav-btn ${activeTab === 'transactions' ? 'active' : ''}`}
          onClick={() => setActiveTab('transactions')}
        >
          <span style={{ fontSize: '1.15rem' }}>📝</span>
          <span>รายการ</span>
        </button>
        <button
          type="button"
          className={`mobile-nav-btn ${activeTab === 'accounts' ? 'active' : ''}`}
          onClick={() => setActiveTab('accounts')}
        >
          <span style={{ fontSize: '1.15rem' }}>💳</span>
          <span>บัตร/ผ่อน</span>
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
          <span style={{ fontSize: '1.15rem' }}>🤝</span>
          <span>เจ้าหนี้</span>
        </button>
        <button
          type="button"
          className={`mobile-nav-btn ${activeTab === 'family' ? 'active' : ''}`}
          onClick={() => setActiveTab('family')}
        >
          <span style={{ fontSize: '1.15rem' }}>🏠</span>
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
                    if (acc && !editingTx) setTxShared(acc.isSharedWithFamily !== false);
                  }}
                >
                  {myAccounts.map((a) => (
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
                    {myAccounts
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
                  {myAssetAccounts.map((a) => (
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
                  value={instAccountId || myCreditAccounts[0]?.id || ''}
                  onChange={(e) => setInstAccountId(e.target.value)}
                  required
                >
                  {myCreditAccounts.map((c) => (
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
                  {myAssetAccounts.map((a) => (
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
                  {myAssetAccounts.map((a) => (
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
