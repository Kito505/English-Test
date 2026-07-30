// ==========================================
// English Test Engine Logic
// ==========================================================

document.addEventListener('DOMContentLoaded', () => {
  // App State Variables
  let activeQuestions = [];
  let userAnswers = {};
  let flaggedQuestions = new Set();
  let currentIndex = 0;
  let timerInterval = null;
  let secondsRemaining = 45 * 60; // 45 minutes countdown
  let testMode = 'exam'; // 'exam' (Resultado al final) or 'instant' (Resultado al instante)

  // DOM Elements
  const startScreen = document.getElementById('startScreen');
  const testScreen = document.getElementById('testScreen');
  const resultsScreen = document.getElementById('resultsScreen');
  const startTestBtn = document.getElementById('startTestBtn');
  const timerBadge = document.getElementById('timerBadge');
  const timerText = document.getElementById('timerText');
  const openMapBtn = document.getElementById('openMapBtn');
  const modeCards = document.querySelectorAll('.mode-card');
  const instantFeedbackBlock = document.getElementById('instantFeedbackBlock');
  
  // Progress Elements
  const questionCounter = document.getElementById('questionCounter');
  const typeBadge = document.getElementById('typeBadge');
  const progressBarFill = document.getElementById('progressBarFill');
  
  // Question Card Elements
  const instructionsText = document.getElementById('instructionsText');
  const passageBlock = document.getElementById('passageBlock');
  const passageText = document.getElementById('passageText');
  const questionText = document.getElementById('questionText');
  const optionsList = document.getElementById('optionsList');
  
  // Action Buttons
  const prevBtn = document.getElementById('prevBtn');
  const nextBtn = document.getElementById('nextBtn');
  const finishBtn = document.getElementById('finishBtn');
  const flagBtn = document.getElementById('flagBtn');
  const flagBtnText = document.getElementById('flagBtnText');
  
  // Modal Elements
  const mapModal = document.getElementById('mapModal');
  const closeMapBtn = document.getElementById('closeMapBtn');
  const questionGrid = document.getElementById('questionGrid');
  
  // Results Elements
  const scorePercentage = document.getElementById('scorePercentage');
  const scoreFraction = document.getElementById('scoreFraction');
  const scoreCircle = document.getElementById('scoreCircle');
  const levelBadge = document.getElementById('levelBadge');
  const breakdownGrid = document.getElementById('breakdownGrid');
  const restartBtn = document.getElementById('restartBtn');
  const reviewBtn = document.getElementById('reviewBtn');
  const reviewContainer = document.getElementById('reviewContainer');
  const reviewList = document.getElementById('reviewList');

  // Fisher-Yates Shuffle Algorithm
  function shuffleArray(array) {
    const arr = [...array];
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  // Mode Selection Handlers
  modeCards.forEach(card => {
    card.addEventListener('click', () => {
      modeCards.forEach(c => c.classList.remove('active'));
      card.classList.add('active');
      testMode = card.dataset.mode || 'exam';
    });
  });

  // Get used question IDs from sessionStorage for anti-repetition across tests
  function getUsedQuestionIds() {
    try {
      const stored = sessionStorage.getItem('english_test_used_ids');
      return stored ? JSON.parse(stored) : [];
    } catch (e) {
      return [];
    }
  }

  function saveUsedQuestionIds(ids) {
    try {
      sessionStorage.setItem('english_test_used_ids', JSON.stringify(ids));
    } catch (e) {}
  }

  // Get deduplicated question pool by category
  function getUniqueCategoryPool(type) {
    const rawCategory = questionsData.filter(q => q.type === type);
    const seen = new Set();
    const uniquePool = [];

    rawCategory.forEach(q => {
      const normText = (q.question || '').replace(/^Q\d+:\s*/i, '').trim().toLowerCase();
      const normPassage = (q.passage || '').trim().toLowerCase();
      const key = `${normText}___${normPassage}`;

      if (!seen.has(key)) {
        seen.add(key);
        uniquePool.push(q);
      }
    });

    return uniquePool;
  }

  // Select N unique questions from pool, prioritizing questions not seen recently
  function selectCategoryQuestions(type, count) {
    const pool = getUniqueCategoryPool(type);
    let usedIds = getUsedQuestionIds();

    // Filter into unused and used
    let freshQuestions = pool.filter(q => !usedIds.includes(q.id));
    let recycledQuestions = pool.filter(q => usedIds.includes(q.id));

    freshQuestions = shuffleArray(freshQuestions);
    recycledQuestions = shuffleArray(recycledQuestions);

    let selected = [];

    if (freshQuestions.length >= count) {
      selected = freshQuestions.slice(0, count);
    } else {
      // Not enough fresh questions, take all available fresh ones and fill with recycled
      selected = [...freshQuestions];
      const remainingNeeded = count - selected.length;
      selected.push(...recycledQuestions.slice(0, remainingNeeded));
      
      // Clean up used IDs for this category
      const selectedIds = new Set(selected.map(q => q.id));
      usedIds = usedIds.filter(id => !pool.some(q => q.id === id) || selectedIds.has(id));
    }

    // Save newly selected IDs to session storage
    const newUsedIds = Array.from(new Set([...usedIds, ...selected.map(q => q.id)]));
    saveUsedQuestionIds(newUsedIds);

    return selected;
  }

  // Initialize and Start Test
  function startTest() {
    // Select 10 unique, non-repeating questions randomly from each category (10 x 4 = 40 questions)
    const selectedVocab = selectCategoryQuestions('vocab', 10);
    const selectedReading = selectCategoryQuestions('reading', 10);
    const selectedComb = selectCategoryQuestions('combination', 10);
    const selectedGrammar = selectCategoryQuestions('grammar', 10);

    // Combine and shuffle the 40 selected questions
    activeQuestions = shuffleArray([
      ...selectedVocab,
      ...selectedReading,
      ...selectedComb,
      ...selectedGrammar
    ]);

    userAnswers = {};
    flaggedQuestions.clear();
    currentIndex = 0;
    secondsRemaining = 45 * 60;

    // Switch Screens
    startScreen.classList.remove('active');
    resultsScreen.classList.remove('active');
    testScreen.classList.add('active');
    
    // Show Controls
    timerBadge.style.display = 'flex';
    openMapBtn.style.display = 'inline-flex';
    
    // Start Timer
    startTimer();

    // Render First Question & Grid
    renderQuestion();
    renderModalGrid();
  }

  // Timer Countdown Logic
  function startTimer() {
    clearInterval(timerInterval);
    updateTimerDisplay();

    timerInterval = setInterval(() => {
      secondsRemaining--;
      updateTimerDisplay();

      if (secondsRemaining <= 0) {
        clearInterval(timerInterval);
        alert('El tiempo ha finalizado. Se enviará tu test automáticamente.');
        finishTest();
      }
    }, 1000);
  }

  function updateTimerDisplay() {
    const minutes = Math.floor(secondsRemaining / 60);
    const secs = secondsRemaining % 60;
    timerText.textContent = `${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;

    if (secondsRemaining < 300) { // Less than 5 mins
      timerBadge.classList.add('warning');
    } else {
      timerBadge.classList.remove('warning');
    }
  }

  // Render Current Question
  function renderQuestion() {
    const q = activeQuestions[currentIndex];

    // Meta Header
    questionCounter.textContent = `Question ${currentIndex + 1} of ${activeQuestions.length}`;
    typeBadge.textContent = q.typeName;
    progressBarFill.style.width = `${((currentIndex + 1) / activeQuestions.length) * 100}%`;

    // Instructions
    instructionsText.textContent = q.instructions;

    // Passage (Type 2 Reading)
    if (q.passage) {
      passageBlock.style.display = 'block';
      passageText.textContent = q.passage;
    } else {
      passageBlock.style.display = 'none';
    }

    // Question Text
    questionText.textContent = q.question;

    // Render Options
    optionsList.innerHTML = '';
    const selectedOption = userAnswers[currentIndex];
    const isAnswered = selectedOption !== undefined;

    q.options.forEach((optText, optIdx) => {
      const optionItem = document.createElement('div');
      let itemClasses = ['option-item'];

      if (testMode === 'instant' && isAnswered) {
        itemClasses.push('disabled');
        if (optIdx === q.correct) {
          itemClasses.push('correct');
          if (optIdx !== selectedOption) {
            itemClasses.push('show-correct');
          }
        } else if (optIdx === selectedOption) {
          itemClasses.push('incorrect');
        }
      } else {
        if (selectedOption === optIdx) {
          itemClasses.push('selected');
        }
      }

      optionItem.className = itemClasses.join(' ');
      
      optionItem.innerHTML = `
        <div class="custom-radio">
          <div class="custom-radio-inner"></div>
        </div>
        <div class="option-text">${optText}</div>
      `;

      if (testMode === 'exam' || !isAnswered) {
        optionItem.addEventListener('click', () => selectOption(optIdx));
      }
      
      optionsList.appendChild(optionItem);
    });

    // Handle Instant Feedback Block (Modo Práctica)
    if (testMode === 'instant' && isAnswered) {
      const isCorrect = selectedOption === q.correct;
      instantFeedbackBlock.style.display = 'block';
      instantFeedbackBlock.className = `instant-feedback-card ${isCorrect ? 'correct' : 'incorrect'}`;
      
      instantFeedbackBlock.innerHTML = `
        <div class="instant-feedback-header">
          ${isCorrect 
            ? '<span>¡Respuesta Correcta! 🎉</span>' 
            : `<span>Respuesta Incorrecta ❌. La opción correcta es: <strong>${q.options[q.correct]}</strong></span>`
          }
        </div>
        <div class="instant-feedback-body">
          <div style="font-weight: 700; margin-bottom: 0.25rem;">Explicación Gramatical:</div>
          <div>${q.explanation}</div>
        </div>
      `;
    } else {
      instantFeedbackBlock.style.display = 'none';
      instantFeedbackBlock.innerHTML = '';
    }

    // Update Navigation Buttons State
    prevBtn.disabled = currentIndex === 0;

    if (currentIndex === activeQuestions.length - 1) {
      nextBtn.style.display = 'none';
      finishBtn.style.display = 'inline-flex';
    } else {
      nextBtn.style.display = 'inline-flex';
      finishBtn.style.display = 'none';
    }

    // Update Flag Button State
    if (flaggedQuestions.has(currentIndex)) {
      flagBtn.classList.add('flagged');
      flagBtnText.textContent = 'Marcada';
    } else {
      flagBtn.classList.remove('flagged');
      flagBtnText.textContent = 'Marcar';
    }

    // Scroll to top of card smoothly
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  // Select Radio Option
  function selectOption(index) {
    if (testMode === 'instant' && userAnswers[currentIndex] !== undefined) {
      return; // Bloqueado en modo práctica tras responder
    }
    userAnswers[currentIndex] = index;
    renderQuestion();
    renderModalGrid();
  }

  // Navigation Logic
  function goToNext() {
    if (currentIndex < activeQuestions.length - 1) {
      currentIndex++;
      renderQuestion();
    }
  }

  function goToPrev() {
    if (currentIndex > 0) {
      currentIndex--;
      renderQuestion();
    }
  }

  function toggleFlag() {
    if (flaggedQuestions.has(currentIndex)) {
      flaggedQuestions.delete(currentIndex);
    } else {
      flaggedQuestions.add(currentIndex);
    }
    renderQuestion();
    renderModalGrid();
  }

  // Question Navigator Grid Modal
  function renderModalGrid() {
    questionGrid.innerHTML = '';
    
    activeQuestions.forEach((q, idx) => {
      const btn = document.createElement('button');
      btn.className = 'grid-btn';
      
      const userChoice = userAnswers[idx];
      if (userChoice !== undefined) {
        if (testMode === 'instant') {
          if (userChoice === q.correct) {
            btn.classList.add('correct');
          } else {
            btn.classList.add('incorrect');
          }
        } else {
          btn.classList.add('answered');
        }
      }

      if (idx === currentIndex) {
        btn.classList.add('current');
      }
      if (flaggedQuestions.has(idx)) {
        btn.classList.add('flagged');
      }

      btn.textContent = idx + 1;
      btn.addEventListener('click', () => {
        currentIndex = idx;
        renderQuestion();
        closeModal();
      });

      questionGrid.appendChild(btn);
    });
  }

  function openModal() {
    renderModalGrid();
    mapModal.classList.add('active');
  }

  function closeModal() {
    mapModal.classList.remove('active');
  }

  // Finish Test & Calculate Score
  function finishTest() {
    clearInterval(timerInterval);
    calculateResults();
  }

  function calculateResults() {
    let totalCorrect = 0;
    const categoryScores = {
      vocab: { correct: 0, total: 0, name: "Vocabulario" },
      reading: { correct: 0, total: 0, name: "Comprensión Lectora" },
      combination: { correct: 0, total: 0, name: "Combinación de Oraciones" },
      grammar: { correct: 0, total: 0, name: "Estructura Gramatical" }
    };

    activeQuestions.forEach((q, idx) => {
      const userChoice = userAnswers[idx];
      const isCorrect = userChoice === q.correct;
      
      categoryScores[q.type].total++;
      if (isCorrect) {
        totalCorrect++;
        categoryScores[q.type].correct++;
      }
    });

    const percentage = Math.round((totalCorrect / activeQuestions.length) * 100);

    // Update UI Scores
    scorePercentage.textContent = `${percentage}%`;
    scoreFraction.textContent = `${totalCorrect} / ${activeQuestions.length}`;
    scoreCircle.style.background = `conic-gradient(var(--primary) ${percentage}%, #e2e8f0 ${percentage}%)`;

    // CEFR Level Assessment
    let levelText = "Nivel Estimado: A1 (Principiante)";
    if (totalCorrect >= 34) {
      levelText = "Nivel Estimado: C1 (Avanzado)";
    } else if (totalCorrect >= 25) {
      levelText = "Nivel Estimado: B2 (Intermedio Alto)";
    } else if (totalCorrect >= 15) {
      levelText = "Nivel Estimado: B1 (Intermedio)";
    } else if (totalCorrect >= 8) {
      levelText = "Nivel Estimado: A2 (Elemental)";
    }
    levelBadge.textContent = levelText;

    // Render Category Breakdown Cards
    breakdownGrid.innerHTML = '';
    Object.values(categoryScores).forEach(cat => {
      const catPct = Math.round((cat.correct / cat.total) * 100);
      const card = document.createElement('div');
      card.className = 'breakdown-card';
      card.innerHTML = `
        <div class="breakdown-card-title">${cat.name}</div>
        <div class="breakdown-card-score">${cat.correct} / ${cat.total} (${catPct}%)</div>
      `;
      breakdownGrid.appendChild(card);
    });

    // Render Detailed Answer Review
    renderReviewList();

    // Switch Screens
    testScreen.classList.remove('active');
    resultsScreen.classList.add('active');
    timerBadge.style.display = 'none';
    openMapBtn.style.display = 'none';
  }

  // Render Detailed Review Section
  function renderReviewList() {
    reviewList.innerHTML = '';
    
    activeQuestions.forEach((q, idx) => {
      const userChoice = userAnswers[idx];
      const isCorrect = userChoice === q.correct;
      const isUnanswered = userChoice === undefined;

      let statusClass = 'incorrect';
      let statusTag = `<span class="review-status-tag incorrect">Incorrecta</span>`;

      if (isCorrect) {
        statusClass = 'correct';
        statusTag = `<span class="review-status-tag correct">Correcta</span>`;
      } else if (isUnanswered) {
        statusClass = 'unanswered';
        statusTag = `<span class="review-status-tag unanswered">Sin Responder</span>`;
      }

      const item = document.createElement('div');
      item.className = `review-item ${statusClass}`;

      let optionsHtml = '';
      q.options.forEach((optText, optIdx) => {
        let optStyle = 'color: var(--text-primary);';
        let badge = '';

        if (optIdx === q.correct) {
          optStyle = 'color: #059669; font-weight: 700;';
          badge = ' <span style="color: #059669;">✓ (Respuesta Correcta)</span>';
        } else if (optIdx === userChoice && !isCorrect) {
          optStyle = 'color: #dc2626; text-decoration: line-through;';
          badge = ' <span style="color: #dc2626;">✗ (Tu Selección)</span>';
        }

        optionsHtml += `<div style="margin-bottom: 0.35rem; ${optStyle}">• ${optText}${badge}</div>`;
      });

      item.innerHTML = `
        <div class="review-status-header">
          <strong>Pregunta ${idx + 1} (${q.typeName})</strong>
          ${statusTag}
        </div>
        <div style="font-size: 0.95rem; color: var(--text-muted); margin-bottom: 0.5rem; font-style: italic;">
          ${q.instructions}
        </div>
        ${q.passage ? `<div style="background: #f1f5f9; padding: 0.75rem; border-radius: 6px; margin-bottom: 0.75rem;"><strong>Passage:</strong> ${q.passage}</div>` : ''}
        <div style="font-weight: 600; margin-bottom: 0.75rem; font-size: 1.05rem;">
          ${q.question}
        </div>
        <div style="margin-bottom: 1rem;">
          ${optionsHtml}
        </div>
        <div class="explanation-box">
          <div class="explanation-title">Explicación Gramatical:</div>
          <div>${q.explanation}</div>
        </div>
      `;

      reviewList.appendChild(item);
    });
  }

  // Event Listeners
  startTestBtn.addEventListener('click', startTest);
  nextBtn.addEventListener('click', goToNext);
  prevBtn.addEventListener('click', goToPrev);
  finishBtn.addEventListener('click', finishTest);
  flagBtn.addEventListener('click', toggleFlag);
  
  openMapBtn.addEventListener('click', openModal);
  closeMapBtn.addEventListener('click', closeModal);
  mapModal.addEventListener('click', (e) => {
    if (e.target === mapModal) closeModal();
  });

  restartBtn.addEventListener('click', startTest);
  
  reviewBtn.addEventListener('click', () => {
    if (reviewContainer.style.display === 'none') {
      reviewContainer.style.display = 'block';
      reviewBtn.querySelector('span').textContent = 'Ocultar Revisión';
      reviewContainer.scrollIntoView({ behavior: 'smooth' });
    } else {
      reviewContainer.style.display = 'none';
      reviewBtn.querySelector('span').textContent = 'Ver Revisión Detallada';
    }
  });

});
