/* ---------------------------------------------------------------------------
 * seed.js — offline/demo data.
 *
 * When GitHub sync is configured, the PRIVATE data repo is the source of truth
 * and this file is ignored (except as a first-run template). It exists so the
 * app runs and is viewable with zero setup — even by double-clicking index.html.
 *
 * The syllabus below is transcribed from the official GATE 2027 CS/IT syllabus
 * (IIT Madras, organizing institute). The on-disk format is a NESTED tree;
 * store.js flattens it into nodes with computed dotted ids, levels and order.
 * ------------------------------------------------------------------------- */
(function () {
  const SYLLABUS = [
    { id: "eng-math", title: "Engineering Mathematics", children: [
      { id: "discrete", title: "Discrete Mathematics", children: [
        { id: "logic", title: "Propositional & First-Order Logic" },
        { id: "sets", title: "Sets, Relations, Functions, Partial Orders & Lattices" },
        { id: "groups", title: "Monoids & Groups" },
        { id: "graphs", title: "Graph Theory: Connectivity, Matching, Colouring" },
        { id: "combinatorics", title: "Combinatorics: Counting, Recurrences, Generating Functions" },
      ]},
      { id: "linalg", title: "Linear Algebra", children: [
        { id: "matrices", title: "Matrices & Determinants" },
        { id: "linsys", title: "System of Linear Equations" },
        { id: "eigen", title: "Eigenvalues & Eigenvectors" },
        { id: "lu", title: "LU Decomposition" },
      ]},
      { id: "calculus", title: "Calculus", children: [
        { id: "limits", title: "Limits, Continuity & Differentiability" },
        { id: "maxmin", title: "Maxima & Minima" },
        { id: "mvt", title: "Mean Value Theorem" },
        { id: "integration", title: "Integration" },
      ]},
      { id: "prob", title: "Probability & Statistics", children: [
        { id: "randvar", title: "Random Variables" },
        { id: "distributions", title: "Uniform, Normal, Exponential, Poisson & Binomial Distributions" },
        { id: "descstats", title: "Mean, Median, Mode & Standard Deviation" },
        { id: "bayes", title: "Conditional Probability & Bayes' Theorem" },
      ]},
    ]},
    { id: "digital", title: "Digital Logic", children: [
      { id: "boolean", title: "Boolean Algebra & Minimization", children: [
        { id: "boolalg", title: "Boolean Algebra (Algebraic Technique)" },
        { id: "kmap", title: "Karnaugh Map" },
        { id: "qm", title: "Tabular Method (Quine–McCluskey)" },
      ]},
      { id: "circuits", title: "Combinational & Sequential Circuits", children: [
        { id: "comb", title: "Combinational Circuit Design" },
        { id: "seq", title: "Sequential Circuit Design" },
      ]},
      { id: "numrep", title: "Number Representation & Arithmetic", children: [
        { id: "fixed", title: "Fixed-Point Representation" },
        { id: "float", title: "Floating-Point Representation" },
      ]},
    ]},
    { id: "coa", title: "Computer Organization & Architecture", children: [
      { id: "isa", title: "Instruction Set & Addressing Modes" },
      { id: "alu", title: "ALU Design" },
      { id: "cu", title: "Control Unit Design", children: [
        { id: "hardwired", title: "Hardwired Control" },
        { id: "micro", title: "Microprogrammed Control" },
      ]},
      { id: "memory", title: "Memory Hierarchy", children: [
        { id: "interfacing", title: "Memory Interfacing" },
        { id: "perf", title: "Performance" },
        { id: "cache", title: "Cache Memory & Mapping" },
      ]},
      { id: "io", title: "I/O Interface", children: [
        { id: "interrupt", title: "Interrupt-Driven I/O" },
        { id: "dma", title: "DMA" },
      ]},
      { id: "pipeline", title: "Instruction Pipelining", children: [
        { id: "pipebasics", title: "Pipelining Basics" },
        { id: "hazards", title: "Pipeline Hazards" },
      ]},
    ]},
    { id: "pds", title: "Programming & Data Structures", children: [
      { id: "c", title: "Programming in C", children: [
        { id: "cprog", title: "Programming in C" },
        { id: "recursion", title: "Recursion" },
      ]},
      { id: "ds", title: "Data Structures", children: [
        { id: "arrays", title: "Arrays" },
        { id: "stacks", title: "Stacks" },
        { id: "queues", title: "Queues" },
        { id: "linkedlists", title: "Linked Lists" },
        { id: "trees", title: "Trees" },
        { id: "bst", title: "Binary Search Trees" },
        { id: "heaps", title: "Binary Heaps" },
        { id: "graphsds", title: "Graphs" },
      ]},
    ]},
    { id: "algo", title: "Algorithms", children: [
      { id: "ssh", title: "Searching, Sorting, Hashing", children: [
        { id: "searching", title: "Searching" },
        { id: "sorting", title: "Sorting" },
        { id: "hashing", title: "Hashing" },
      ]},
      { id: "complexity", title: "Complexity Analysis", children: [
        { id: "asymptotic", title: "Asymptotic Worst-Case Time & Space Complexity" },
      ]},
      { id: "design", title: "Algorithm Design Techniques", children: [
        { id: "greedy", title: "Greedy" },
        { id: "dp", title: "Dynamic Programming" },
        { id: "dnc", title: "Divide & Conquer" },
      ]},
      { id: "graphalgo", title: "Graph Algorithms", children: [
        { id: "traversal", title: "Graph Traversals" },
        { id: "mst", title: "Minimum Spanning Trees" },
        { id: "sp", title: "Shortest Paths" },
      ]},
    ]},
    { id: "toc", title: "Theory of Computation", children: [
      { id: "regular", title: "Regular Languages", children: [
        { id: "refa", title: "Regular Expressions & Finite Automata" },
        { id: "reglang", title: "Regular Languages & Closure" },
        { id: "pumping", title: "Pumping Lemma (Regular)" },
      ]},
      { id: "cfl", title: "Context-Free Languages", children: [
        { id: "cfgpda", title: "Context-Free Grammars & Push-Down Automata" },
        { id: "cfllang", title: "Context-Free Languages" },
      ]},
      { id: "tm", title: "Turing Machines & Undecidability", children: [
        { id: "turing", title: "Turing Machines" },
        { id: "undecidable", title: "Undecidability" },
      ]},
    ]},
    { id: "compiler", title: "Compiler Design", children: [
      { id: "frontend", title: "Lexical Analysis & Parsing", children: [
        { id: "lexical", title: "Lexical Analysis" },
        { id: "parsing", title: "Parsing" },
        { id: "sdt", title: "Syntax-Directed Translation" },
      ]},
      { id: "runtime", title: "Runtime Environments" },
      { id: "icg", title: "Intermediate Code Generation" },
      { id: "optimization", title: "Code Optimization", children: [
        { id: "localopt", title: "Local Optimisation" },
        { id: "dataflow", title: "Data Flow Analysis (constant propagation, liveness, CSE)" },
      ]},
    ]},
    { id: "os", title: "Operating System", children: [
      { id: "proc", title: "Processes & Concurrency", children: [
        { id: "syscalls", title: "System Calls" },
        { id: "processes", title: "Processes & Threads" },
        { id: "ipc", title: "Inter-Process Communication" },
        { id: "sync", title: "Concurrency & Synchronization" },
      ]},
      { id: "deadlock", title: "Deadlock" },
      { id: "scheduling", title: "CPU & I/O Scheduling" },
      { id: "memmgmt", title: "Memory Management & Virtual Memory" },
      { id: "fs", title: "File Systems" },
    ]},
    { id: "dbms", title: "Databases", children: [
      { id: "er", title: "ER Model" },
      { id: "relational", title: "Relational Model", children: [
        { id: "relalg", title: "Relational Algebra" },
        { id: "tuplecalc", title: "Tuple Calculus" },
        { id: "sql", title: "SQL" },
      ]},
      { id: "constraints", title: "Integrity Constraints & Normal Forms", children: [
        { id: "integrity", title: "Integrity Constraints" },
        { id: "normalforms", title: "Normal Forms" },
      ]},
      { id: "fileidx", title: "File Organization & Indexing", children: [
        { id: "fileorg", title: "File Organization" },
        { id: "indexing", title: "Indexing (B & B+ Trees)" },
      ]},
      { id: "txn", title: "Transactions & Concurrency Control" },
    ]},
    { id: "cn", title: "Computer Networks", children: [
      { id: "layering", title: "Layering & Switching", children: [
        { id: "layers", title: "Principles of Layering" },
        { id: "switching", title: "Switching (Circuit, Packet, Virtual Circuit)" },
        { id: "perfmetrics", title: "Performance Metrics" },
      ]},
      { id: "datalink", title: "Data Link Layer", children: [
        { id: "errordetect", title: "Error Detection" },
        { id: "mac", title: "Medium Access Control" },
        { id: "ethernet", title: "Ethernet" },
      ]},
      { id: "routing", title: "Routing", children: [
        { id: "dv", title: "Distance Vector Routing" },
        { id: "ls", title: "Link State Routing" },
      ]},
      { id: "network", title: "Network Layer (IPv4)", children: [
        { id: "ipv4", title: "IPv4 & Fragmentation" },
        { id: "cidr", title: "CIDR Notation" },
        { id: "nat", title: "Network Address Translation" },
      ]},
      { id: "transport", title: "Transport Layer", children: [
        { id: "tcpflow", title: "TCP Flow Control" },
        { id: "tcpcong", title: "TCP Congestion Control" },
        { id: "socket", title: "Socket API" },
      ]},
      { id: "application", title: "Application Layer", children: [
        { id: "dns", title: "DNS" },
        { id: "http", title: "HTTP" },
      ]},
    ]},
  ];

  // Sample notes keyed by full (dotted) node id. Bodies are arrays of lines so
  // that markdown ``` fences and $KaTeX$ survive as plain data.
  const NOTES = {
    "toc.regular.pumping": {
      title: "Pumping Lemma (Regular)",
      status: "verified", rating: 1180, model: "claude-opus-via-foundry",
      updated: "2026-09-22",
      prereqs: ["toc.regular.refa"], related: ["toc.regular.reglang"],
      body: [
        "The **pumping lemma** gives a *necessary* condition for a language to be regular. It is most often used to **prove a language is _not_ regular**.",
        "",
        "> If $L$ is regular, there exists a constant $p$ (the pumping length) such that every $w \\in L$ with $|w| \\ge p$ can be written $w = xyz$ where:",
        ">",
        "> 1. $|xy| \\le p$",
        "> 2. $|y| \\ge 1$",
        "> 3. $x y^{i} z \\in L$ for all $i \\ge 0$.",
        "",
        "### Classic application",
        "",
        "Show $L = \\{a^n b^n \\mid n \\ge 0\\}$ is **not** regular. Assume it is, with pumping length $p$; pick $w = a^p b^p$. By condition 1, $y$ is all $a$'s, so pumping $y$ changes the count of $a$'s but not $b$'s — contradiction.",
        "",
        "A DFA for the *related* regular language $a^* b^*$:",
        "",
        "```mermaid",
        "stateDiagram-v2",
        "  [*] --> A",
        "  A --> A: a",
        "  A --> B: b",
        "  B --> B: b",
        "  A --> [*]",
        "  B --> [*]",
        "```",
        "",
        "See also [[toc.regular.refa]] and closure properties in [[toc.regular.reglang]].",
      ].join("\n"),
    },
    "algo.design.dp": {
      title: "Dynamic Programming",
      status: "draft", rating: 1240, model: "gpt-via-foundry",
      updated: "2026-09-22",
      prereqs: ["algo.design.dnc"], related: ["algo.design.greedy"],
      body: [
        "**Dynamic programming (DP)** solves a problem by combining solutions to *overlapping* subproblems, computing each subproblem once (memoisation or tabulation).",
        "",
        "Two hallmarks:",
        "- **Optimal substructure** — an optimal solution is built from optimal subsolutions.",
        "- **Overlapping subproblems** — the same subproblems recur.",
        "",
        "### 0/1 Knapsack recurrence",
        "",
        "$$OPT(i, w) = \\max\\bigl(OPT(i-1, w),\\; v_i + OPT(i-1, w - w_i)\\bigr)$$",
        "",
        "| Technique | Time | Space |",
        "|---|---|---|",
        "| Naive recursion | $O(2^n)$ | $O(n)$ |",
        "| DP (tabulation) | $O(nW)$ | $O(nW)$ |",
        "",
        "Contrast with [[algo.design.greedy]] (never reconsiders a choice) and [[algo.design.dnc]] (non-overlapping subproblems).",
      ].join("\n"),
    },
    "os.deadlock": {
      title: "Deadlock",
      status: "draft", rating: 1200, model: "claude-opus-via-foundry",
      updated: "2026-09-22",
      prereqs: ["os.proc.sync"], related: ["os.scheduling"],
      body: [
        "A **deadlock** is a set of processes each blocked waiting for a resource held by another in the same set.",
        "",
        "### Coffman conditions (all four must hold simultaneously)",
        "1. Mutual exclusion",
        "2. Hold and wait",
        "3. No preemption",
        "4. Circular wait",
        "",
        "```mermaid",
        "graph LR",
        "  P1 -->|requests| R1",
        "  R1 -->|held by| P2",
        "  P2 -->|requests| R2",
        "  R2 -->|held by| P1",
        "```",
        "",
        "Breaking **any one** condition prevents deadlock. See [[os.scheduling]] for interactions with scheduling.",
      ].join("\n"),
    },
  };

  const QUESTIONS = [
    {
      id: "toc-regular-001", node_id: "toc.regular", type: "MSQ",
      source: "generated", difficulty_elo: 1250, model: "claude-opus-via-foundry", verified: true,
      stem_md: "Which of the following languages over $\\Sigma=\\{a,b\\}$ are **regular**? *(Select all that apply.)*",
      options: [
        { id: "A", md: "$\\{a^n b^n \\mid n \\ge 0\\}$" },
        { id: "B", md: "$\\{w \\mid w \\text{ has an even number of } a\\text{'s}\\}$" },
        { id: "C", md: "$(ab)^*$" },
        { id: "D", md: "$\\{a^p \\mid p \\text{ is prime}\\}$" },
      ],
      answer: ["B", "C"],
      solution_md: "**A** and **D** are the classic non-regular languages (provable via the pumping lemma). **B** is recognised by a 2-state DFA tracking parity; **C** is literally a regular expression.",
    },
    {
      id: "algo-dp-001", node_id: "algo.design.dp", type: "MCQ",
      source: "PYQ:GATE-2019", difficulty_elo: 1300, model: "", verified: true,
      stem_md: "The standard 0/1-knapsack dynamic program on $n$ items and capacity $W$ runs in time:",
      options: [
        { id: "A", md: "$O(n \\log n)$" },
        { id: "B", md: "$O(nW)$ (pseudo-polynomial)" },
        { id: "C", md: "$O(2^n)$" },
        { id: "D", md: "$O(n^2)$" },
      ],
      answer: ["B"],
      solution_md: "It is $O(nW)$ — **pseudo-polynomial**, since $W$ can be exponential in the number of bits used to encode it.",
    },
  ];

  const STUDY_PATH = [
    "toc.regular.refa", "toc.regular.reglang", "toc.regular.pumping",
    "algo.design.dnc", "algo.design.dp", "os.deadlock",
  ];

  window.SEED = { syllabus: SYLLABUS, notes: NOTES, questions: QUESTIONS, study_path: STUDY_PATH };
})();
