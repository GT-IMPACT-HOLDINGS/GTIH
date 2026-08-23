# Lexiom Deterministic Human–AI Collaboration System
## Patent Figures 1–11

**Companion to:** Lexiom_Provisional_Patent_Technical_Disclosure.md  
**Purpose:** Visual representations of architecture, workflows, and data structures for provisional patent filing.  
**Incorporation:** These figures are incorporated by reference in the technical disclosure for earliest-date priority purposes. Figure numbers 1–11 correspond exactly to the narrative descriptions in Section 12 of the disclosure.

---

## Figure 1 — System Architecture Diagram

Block diagram of major system components and data flow.

```mermaid
flowchart TB
    subgraph User
        UI[User Interface]
    end

    subgraph Core
        STE[State Transition Engine]
        EDB[Event Dispatch Bus<br/>AI Bus]
        PLM[Provenance Ledger Manager]
        STE --> EDB
        STE --> PLM
    end

    subgraph Consumers
        STE2[Semantic Transformation Engine]
        UIRE[User Interface Rendering Engine]
        EDB --> STE2
        EDB --> UIRE
    end

    subgraph Support
        CCM[Collaboration Control Module]
        ASS[Artifact Storage System]
        PLM --> ASS
        PLM <--> CCM
    end

    UI -->|interactions| STE
    STE -->|White Move outcomes| EDB
    STE2 -.->|draft/index only| STE
    UIRE -.->|draft/index only| UI
    PLM -->|canonical state| STE
```

---

## Figure 2 — White-Black Round State Machine

Three-state temporal model: White → Black → Stability.

```mermaid
stateDiagram-v2
    [*] --> Stability
    
    Stability --> White : qualified user interaction
    White --> Black : White Move completion
    Black --> Stability : Black Move completion
    
    note right of White : Canonical mutation only in White
    note right of Black : Draft/index update only
    note right of Stability : No mutation
```

---

## Figure 3 — AI Bus Event Flow

Sequence of event dispatch; canonical mutation only from White Move.

```mermaid
sequenceDiagram
    participant U as User
    participant STE as State Transition Engine
    participant PLM as Provenance Ledger Manager
    participant EDB as Event Dispatch Bus
    participant STEng as Semantic Transformation Engine
    participant UIRE as User Interface Rendering Engine

    U->>STE: interaction
    STE->>PLM: apply White Move
    STE->>EDB: emit Event
    EDB->>STEng: Event
    EDB->>UIRE: Event
    Note over STEng,UIRE: draft/index state only<br/>(no canonical mutation)
```

---

## Figure 4 — Provenance Spine Data Graph

Directed acyclic graph of Moves; mainline vs. side paths.

```mermaid
flowchart LR
    subgraph Mainline
        M1[M1<br/>ACCEPTED]
        M2[M2<br/>ACCEPTED]
        M3[M3<br/>ACCEPTED]
        M1 --> M2 --> M3
    end

    subgraph SidePath
        P1[P1<br/>PUBLISHED]
        P2[P2<br/>PUBLISHED]
        M2 --> P1
        M2 --> P2
    end

    subgraph Artifacts
        A1((artifact #hash1))
        A2((artifact #hash2))
    end

    M1 -.-> A1
    M2 -.-> A2
    P1 -.-> A2
```

---

## Figure 5 — User Interface Layout (Center-Playfield-Only Execution)

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│  Top HUD (fixed height): L1 Case Identity  |  L2 Topic Lenses                    │
├───────────────┬──────────────────────────────────────────┬───────────────────────┤
│               │                                          │                       │
│  Left 20%     │           Center 60%                     │  Right 20%            │
│  Stage Tower  │     [ SOLE EXECUTION SURFACE ]           │  Shared Collab State  │
│  Proposed     │     All editing & approval occur here    │  Private Artifacts    │
│  Actions      │         ↑ entity bindings ↑              │                       │
│  (index only) │                                          │  (index only)         │
│               │                                          │                       │
├───────────────┴──────────────────────────────────────────┴───────────────────────┤
│  Bottom Ribbon: L3 Quick Statements (3)                                           │
└─────────────────────────────────────────────────────────────────────────────────┘

Legend: Index only—no inline editing in panels  |  All editing and approval in Center
```

---

## Figure 6 — Semantic Transformation Pipeline

```mermaid
flowchart LR
    A[User Input<br/>Position] --> B[Parse]
    B --> C[Extract Interest]
    C --> D[Generate Constructive<br/>Proposal (draft)]
    D --> E[Store in draft space]
    E --> F{White Move<br/>approved?}
    F -->|Yes| G[Create Move<br/>Append to provenance]
    F -->|No| E

    style D fill:#ffe0e0
    style E fill:#ffe0e0
    style G fill:#e0ffe0
```

*Draft stages (red tint): Not canonical. Canonical promotion (green): Requires White Move.*

---

## Figure 7 — Five-Layer Orthogonal Architecture

```mermaid
flowchart TB
    L5[Layer 5: Strategic<br/>8 axes, anti-flattening, optionality]
    L4[Layer 4: Semantic<br/>Position→Interest→Proposal]
    L3[Layer 3: Spatial<br/>Center-only execution]
    L2[Layer 2: Temporal<br/>White→Black→Stability]
    L1[Layer 1: Provenance<br/>Immutable Moves, content-addressed]

    L5 --> L4 --> L3 --> L2 --> L1

    note1[No cross-layer mutation<br/>Constitutional invariants enforced]
```

---

## Figure 8 — Draft-Publish-Accept Workflow

```mermaid
flowchart LR
    A[Move Created] --> B[DRAFT<br/>private]
    B --> C[User Publish]
    C --> D[PUBLISHED<br/>shared board]
    D --> E{All participants<br/>Accept?}
    E -->|Yes| F[ACCEPTED<br/>mainline, canonical]
    E -->|No| D
    F -.->|optional| G[Supersede<br/>new Move replaces]

    note[Unanimous acceptance gate<br/>before canonical]
```

---

## Figure 9 — L2 Topic Lenses and L3 Semantic Acceleration

```mermaid
flowchart TB
    subgraph TopHUD
        L2[L2 Selector: Clarification | Impact | Resolution | Options]
    end

    subgraph Center
        CP[Center Playfield<br/>current semantic mode]
    end

    subgraph BottomRibbon
        L3A["L3: Reframe toward shared impact"]
        L3B["L3: Clarify underlying expectations"]
        L3C["L3: Suggest symmetrical formulation"]
    end

    L2 --> CP
    L3A --> WM[L3 click = White Move]
    L3B --> WM
    L3C --> WM
    WM --> RB[Restricted Black<br/>Center + L3 only]
    RB --> CP
```

*L3 click = explicit White Move; restricted scope prevents cascade.*

---

## Figure 10 — Eight-Fold Strategic Matrix Axes

```mermaid
flowchart TB
    P[Proposal]

    subgraph Axes
        A1[(1) Position Self]
        A2[(2) Interests Self]
        A3[(3) Position Other]
        A4[(4) Interests Other]
        A5[(5) Leverage Self]
        A6[(6) Leverage Other]
        A7[(7) Risk Surface]
        A8[(8) Strategic Pathways]
    end

    P --> A1
    P --> A2
    P --> A3
    P --> A4
    P --> A5
    P --> A6
    P --> A7
    P --> A8
```

*Multi-axis completion bias; anti-flattening; optionality preservation.*

---

## Figure 11 — Zenith vs. Accord Mode Architecture

```mermaid
flowchart TB
    subgraph Zenith
        Z1[Single User]
        Z2[Private canonical state]
        Z3[Shared board disabled]
        Z1 --> Z2 --> Z3
    end

    subgraph Accord
        A1[Multiple Users]
        A2[Private workspaces<br/>each with center playfield]
        A3[Shared board<br/>published Proposals]
        A4[Unanimous Accept gate]
        A1 --> A2 --> A3 --> A4
    end

    Zenith -->|upgrade path| Accord

    note[Same layout structure<br/>Mode toggle]
```

---

*End of Figures — Lexiom Provisional Patent*
