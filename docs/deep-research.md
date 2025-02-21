Token Usage:
GitHub Tokens: 11354
LLM Input Tokens: 0
LLM Output Tokens: 0
Total Tokens: 11354

FileTree:
README.md
examples/inference.md
langgraph.json
pyproject.toml
src/open_deep_research/__init__.py
src/open_deep_research/configuration.py
src/open_deep_research/graph.py
src/open_deep_research/prompts.py
src/open_deep_research/state.py
src/open_deep_research/utils.py

Analysis:
README.md
# Open Deep Research
 
Open Deep Research is a web research assistant that generates comprehensive reports on any topic following a workflow similar to [OpenAI](https://openai.com/index/introducing-deep-research/) and [Gemini](https://blog.google/products/gemini/google-gemini-deep-research/) Deep Research. However, it allows you to customize the models, prompts, report structure, search API, and research depth. Specifically, you can customize:

- provide an outline with a desired report structure
- set the planner model (e.g., DeepSeek, OpenAI reasoning model, etc)
- give feedback on the plan of report sections and iterate until user approval 
- set the search API (e.g., Tavily, Perplexity) and # of searches to run for each research iteration
- set the depth of search for each section (# of iterations of writing, reflection, search, re-write)
- customize the writer model (e.g., Anthropic)

![report-generation](https://github.com/user-attachments/assets/6595d5cd-c981-43ec-8e8b-209e4fefc596)

## 🚀 Quickstart

Ensure you have API keys set for your desired tools.

Select a web search tool (by default Open Deep Research uses Tavily):

* [Tavily API](https://tavily.com/)
* [Perplexity API](https://www.perplexity.ai/hub/blog/introducing-the-sonar-pro-api)

Select a writer model (by default Open Deep Research uses Anthropic):

* [Anthropic](https://www.anthropic.com/)

Select a planner model (by default Open Deep Research uses OpenAI o3-mini):

* [OpenAI](https://openai.com/)
* [Groq](https://groq.com/)

### Using the package

(Recommended: Create a virtual environment):
```
python -m venv open_deep_research
source open_deep_research/bin/activate
```

Install:
```
pip install open-deep-research
```

See [src/open_deep_research/graph.ipynb](src/open_deep_research/graph.ipynb) for an example of usage in a Jupyter notebook.

Import and compile the graph:
```python
from langgraph.checkpoint.memory import MemorySaver
from open_deep_research.graph import builder
memory = MemorySaver()
graph = builder.compile(checkpointer=memory)
```

View the graph:
```python
from IPython.display import Image, display
display(Image(graph.get_graph(xray=1).draw_mermaid_png()))
```

Run the graph with a desired topic and configuration:
```python
import uuid 
thread = {"configurable": {"thread_id": str(uuid.uuid4()),
                           "search_api": "tavily",
                           "planner_provider": "openai",
                           "max_search_depth": 1,
                           "planner_model": "o3-mini"}}

topic = "Overview of the AI inference market with focus on Fireworks, Together.ai, Groq"
async for event in graph.astream({"topic":topic,}, thread, stream_mode="updates"):
    print(event)
    print("\n")
```

The graph will stop when the report plan is generated, and you can pass feedback to update the report plan:
```python
from langgraph.types import Command
async for event in graph.astream(Command(resume="Include a revenue estimate (ARR) in the sections"), thread, stream_mode="updates"):
    print(event)
    print("\n")
```

When you are satisfied with the report plan, you can pass `True` to proceed to report generation:
```
# Pass True to approve the report plan and proceed to report generation
async for event in graph.astream(Command(resume=True), thread, stream_mode="updates"):
    print(event)
    print("\n")
```

### Running LangGraph Studio UI locally

Clone the repository:
```bash
git clone https://github.com/langchain-ai/open_deep_research.git
cd open_deep_research
```

Edit the `.env` file with your API keys (e.g., the API keys for default selections are shown below):

```bash
cp .env.example .env
```

Set:
```bash
export TAVILY_API_KEY=<your_tavily_api_key>
export ANTHROPIC_API_KEY=<your_anthropic_api_key>
export OPENAI_API_KEY=<your_openai_api_key>
```

Launch the assistant with the LangGraph server locally, which will open in your browser:

#### Mac

```bash
# Install uv package manager
curl -LsSf https://astral.sh/uv/install.sh | sh

# Install dependencies and start the LangGraph server
uvx --refresh --from "langgraph-cli[inmem]" --with-editable . --python 3.11 langgraph dev
```

#### Windows

```powershell
# Install dependencies 
pip install -e .
pip install langgraph-cli[inmem]

# Start the LangGraph server
langgraph dev
```

Use this to open the Studio UI:
```
- 🚀 API: http://127.0.0.1:2024
- 🎨 Studio UI: https://smith.langchain.com/studio/?baseUrl=http://127.0.0.1:2024
- 📚 API Docs: http://127.0.0.1:2024/docs
```

(1) Provide a `Topic` and hit `Submit`:

<img width="1326" alt="input" src="https://github.com/user-attachments/assets/de264b1b-8ea5-4090-8e72-e1ef1230262f" />

(2) This will generate a report plan and present it to the user for review.

(3) We can pass a string (`"..."`) with feedback to regenerate the plan based on the feedback.

<img width="1326" alt="feedback" src="https://github.com/user-attachments/assets/c308e888-4642-4c74-bc78-76576a2da919" />

(4) Or, we can just pass `true` to accept the plan.

<img width="1480" alt="accept" src="https://github.com/user-attachments/assets/ddeeb33b-fdce-494f-af8b-bd2acc1cef06" />

(5) Once accepted, the report sections will be generated.

<img width="1326" alt="report_gen" src="https://github.com/user-attachments/assets/74ff01cc-e7ed-47b8-bd0c-4ef615253c46" />

The report is produced as markdown.

<img width="1326" alt="report" src="https://github.com/user-attachments/assets/92d9f7b7-3aea-4025-be99-7fb0d4b47289" />



## 📖 Customizing the report

You can customize the research assistant's behavior through several parameters:

- `report_structure`: Define a custom structure for your report (defaults to a standard research report format)
- `number_of_queries`: Number of search queries to generate per section (default: 2)
- `max_search_depth`: Maximum number of reflection and search iterations (default: 2)
- `planner_provider`: Model provider for planning phase (default: "openai", but can be "groq")
- `planner_model`: Specific model for planning (default: "o3-mini", but can be any Groq hosted model such as "deepseek-r1-distill-llama-70b")
- `writer_model`: Model for writing the report (default: "claude-3-5-sonnet-latest")
- `search_api`: API to use for web searches (default: Tavily)

These configurations allow you to fine-tune the research process based on your needs, from adjusting the depth of research to selecting specific AI models for different phases of report generation.

## How it works
   
1. `Plan and Execute` - Open Deep Research follows a [plan-and-execute workflow](https://github.com/assafelovic/gpt-researcher) that separates planning from research, allowing for human-in-the-loop approval of a report plan before the more time-consuming research phase. It uses, by default, a [reasoning model](https://www.youtube.com/watch?v=f0RbwrBcFmc) to plan the report sections. During this phase, it uses web search to gather general information about the report topic to help in planning the report sections. But, it also accepts a report structure from the user to help guide the report sections as well as human feedback on the report plan.
   
2. `Research and Write` - Each section of the report is written in parallel. The research assistant uses web search via [Tavily API](https://tavily.com/) or [Perplexity](https://www.perplexity.ai/hub/blog/introducing-the-sonar-pro-api) to gather information about each section topic. It will reflect on each report section and suggest follow-up questions for web search. This "depth" of research will proceed for any many iterations as the user wants. Any final sections, such as introductions and conclusions, are written after the main body of the report is written, which helps ensure that the report is cohesive and coherent. The planner determines main body versus final sections during the planning phase.

3. `Managing different types` - Open Deep Research is built on LangGraph, which has native support for configuration management [using assistants](https://langchain-ai.github.io/langgraph/concepts/assistants/). The report `structure` is a field in the graph configuration, which allows users to create different assistants for different types of reports. 

## UX

### Local deployment

Follow the [quickstart](#quickstart) to start LangGraph server locally.

### Hosted deployment
 
You can easily deploy to [LangGraph Platform ](https://langchain-ai.github.io/langgraph/concepts/#deployment-options). 

examples/inference.md
# AI Inference Market and Key Players Overview

The AI inference market is experiencing explosive growth, projected to expand from $24.6 billion in 2024 to $133.2 billion by 2034. This transformation is being driven by innovative companies developing breakthrough optimization technologies that dramatically improve performance while reducing costs. Among these pioneers, Fireworks AI has demonstrated enterprise-grade reliability by processing 140 billion tokens daily, while Together.ai has achieved 4x faster decoding throughput than traditional solutions. Groq's Language Processing Unit (LPU) has emerged as a particularly disruptive force, offering competitive pricing from $0.05 to $0.99 per million tokens while securing a $2.8 billion valuation.

## Key Players Comparison

| Feature | Fireworks AI | Together.ai | Groq |
|---------|-------------|-------------|------|
| Daily Processing | 140B tokens | 400 tokens/sec | Not disclosed |
| Pricing Range | $0.10-$1.20/M tokens | Custom pricing | $0.05-$0.99/M tokens |
| Key Innovation | Parameter-based pricing | FlashAttention-3 | Language Processing Unit |
| Enterprise Users | Uber, DoorDash | Salesforce, Washington Post | Hunch AI, aiXplain |
| Valuation | $552M | $100M ARR | $2.8B |

These players are reshaping the inference landscape through distinct approaches to optimization and pricing, with each targeting different segments of the rapidly expanding market. Their continued innovation suggests further disruption in the AI infrastructure space.

## Global AI Inference Market Analysis

**The AI inference market is projected to grow from $24.6 billion in 2024 to $133.2 billion by 2034, driven by breakthrough optimization technologies that are dramatically improving performance while reducing costs.** Cloud deployment currently dominates with 55% market share, though on-premises solutions are gaining traction for latency-sensitive and security-focused applications.

NVIDIA maintains market leadership with approximately 80% share of AI chips, while competitors like AMD, Intel, and cloud providers are investing heavily in specialized inference solutions. Recent advances in speculative decoding and compilation techniques have enabled up to 2x higher throughput at 50% lower costs for popular models like Llama and Mixtral.

Key barriers to adoption include:
- High infrastructure costs and unclear ROI
- Data quality and quantity challenges
- Integration complexity with existing systems
- Skills gaps in AI/ML expertise
- Privacy and regulatory concerns

North America leads regional adoption with 38% market share, particularly in financial services and healthcare verticals. Microsoft's implementation of NVIDIA inference solutions for Copilot demonstrates the technology's enterprise readiness.

### Sources
- Restack AI Hardware Analysis 2024: https://www.restack.io/p/hardware-innovations-for-ai-technologies-answer-leading-ai-hardware-companies-2024
- NVIDIA Developer Blog: https://developer.nvidia.com/blog/optimize-ai-inference-performance-with-nvidia-full-stack-solutions/
- Market.us AI Inference Report: https://scoop.market.us/ai-inference-server-market-news/

## Fireworks AI Technical Analysis

**Fireworks AI combines an innovative pricing model with proven enterprise performance, demonstrated by processing 140 billion tokens daily with 99.99% API uptime across 12,000 users.** Their tiered pricing structure scales with usage, starting at $0.10 per million tokens for small models and reaching $1.20 per million tokens for large MoE architectures.

The platform offers specialized pricing for different modalities:
- Text generation with parameter-based pricing ($0.10-$1.20/M tokens)
- Image generation at $0.00013 per step
- Speech-to-text processing from $0.0009 per audio minute
- On-demand GPU deployments ranging from $2.90 to $9.99 per hour

A notable implementation at Sourcegraph showcases the platform's capabilities, where StarCoder deployment doubled code completion acceptance rates while cutting backend latency by 50%. The company's recent $52M Series B funding values it at $552M, with Forbes estimating 2023 revenue at $3M.

Enterprise customers including Uber, DoorDash, and Upwork have adopted Fireworks AI's infrastructure, citing lower costs and reduced latency compared to alternatives. The platform's spending limits increase with usage history, from $50/month to custom enterprise tiers exceeding $50,000/month.

### Sources
- Fireworks AI Blog Spring Update: https://fireworks.ai/blog/spring-update-faster-models-dedicated-deployments-postpaid-pricing
- AWS Case Study: https://aws.amazon.com/solutions/case-studies/fireworks-ai-case-study/
- Funding News: https://www.pymnts.com/news/investment-tracker/2024/fireworks-ai-valued-552-million-dollars-after-new-funding-round/

## Together.ai's Inference Stack Analysis

**Together.ai has revolutionized LLM inference by achieving 4x faster decoding throughput than open-source vLLM through an integrated approach combining hardware optimization and algorithmic innovations.** Their Inference Engine 2.0 demonstrates superior performance by processing over 400 tokens per second on Meta's Llama 3 8B model.

The technical foundation relies on four key innovations:
- FlashAttention-3 optimization achieving 75% GPU utilization
- Custom-built draft models trained beyond 10x Chinchilla optimal
- Advanced speculative decoding combining Medusa and Sequoia techniques
- Quality-preserving quantization matching FP16 precision

A notable case study demonstrates their efficiency at scale: using just two A100 GPUs, Together Lite outperforms vLLM running on eight H100 GPUs by 30% in common inference scenarios. This translates to a 12x cost reduction compared to standard deployments.

The Enterprise Platform builds on these innovations while maintaining SOC 2, GDPR, and HIPAA compliance. Major enterprises including Salesforce and The Washington Post have validated its performance in production environments, contributing to Together.ai reaching $100M ARR within 10 months of launch.

### Sources
- Together Inference Engine 2.0 Announcement: https://www.together.ai/blog/together-inference-engine-2
- Enterprise Platform Security: https://www.togetherplatform.com/security-compliance
- Speculative Decoding Implementation: https://www.together.ai/blog/speculative-decoding-for-high-throughput-long-context-inference

## Groq's Inference Engine Performance and Market Traction

**Groq's Language Processing Unit (LPU) has demonstrated unprecedented inference speeds while achieving significant market validation, with an estimated $3.4 million revenue in 2023 and a $2.8 billion valuation following their August 2024 Series D round.**

The LPU's competitive pricing structure ranges from $0.05 to $0.99 per million tokens, depending on model size and input/output requirements. For example, their Llama 3.3 70B implementation charges $0.59 per million input tokens and $0.79 per million output tokens, positioning them favorably against cloud competitors.

Developer adoption has been robust, with notable implementations including:
- Hunch AI Workspace for rapid prototyping
- aiXplain's real-time inference solutions
- Argonne National Laboratory's research applications
- Embodied's Moxie education robot

The platform offers an OpenAI-compatible API supporting multiple models including Llama 3.3, Mixtral 8x7b, and Gemma 2. Integration options include LangChain compatibility and Retrieval Augmented Generation capabilities, enabling developers to incorporate proprietary data into their applications.

### Sources
- Sacra Company Analysis: https://sacra.com/c/groq/
- Groq Pricing Documentation: https://groq.com/pricing/
- ChipStrat Analysis: https://www.chipstrat.com/p/the-rise-of-groq-slow-then-fast
- Groq API Documentation: https://distilabel.argilla.io/1.2.1/api/llm/groq/

## Market and Provider Analysis Summary

The AI inference market is experiencing rapid growth, projected to reach $133.2 billion by 2034, with cloud deployment currently dominating at 55% market share. Among emerging providers, Fireworks AI, Together.ai, and Groq demonstrate distinct competitive advantages in performance and pricing strategies.

| Provider | Key Differentiator | Performance Metric | Revenue/Valuation |
|----------|-------------------|-------------------|-------------------|
| Fireworks AI | Enterprise-grade reliability | 140B tokens/day, 99.99% uptime | $3M (2023), $552M valuation |
| Together.ai | Advanced optimization stack | 4x faster than vLLM, 400 tokens/sec | $100M ARR |
| Groq | Custom LPU architecture | Industry-leading latency | $3.4M (2023), $2.8B valuation |

These providers are addressing key market barriers through innovative pricing models, ranging from $0.05 to $1.20 per million tokens, while delivering specialized solutions for different modalities and use cases. Their success in attracting major enterprise customers suggests growing market maturity, though NVIDIA's 80% chip market share indicates continued infrastructure dependencies.
langgraph.json
```.json
{
    "dockerfile_lines": [],
    "graphs": {
      "open_deep_research": "./src/open_deep_research/graph.py:graph"
    },
    "python_version": "3.11",
    "env": "./.env",
    "dependencies": [
      "."
    ]
  }
```
pyproject.toml
```.toml
[project]
name = "open_deep_research"
version = "0.0.4"
description = "Planning, research, and report generation."
authors = [
    { name = "Lance Martin" }
]
readme = "README.md"
license = { text = "MIT" }
requires-python = ">=3.9" 
dependencies = [
    "langgraph>=0.2.55",
    "langchain-community>=0.3.9",
    "langchain-openai>=0.3.5",
    "langchain-anthropic>=0.3.3",
    "openai>=1.61.0",
    "tavily-python>=0.5.0",
    "langchain-groq>=0.2.4",
]

[project.optional-dependencies]
dev = ["mypy>=1.11.1", "ruff>=0.6.1"]

[build-system]
requires = ["setuptools>=73.0.0", "wheel"]
build-backend = "setuptools.build_meta"

[tool.setuptools]
packages = ["open_deep_research"]

[tool.setuptools.package-dir]
"open_deep_research" = "src/open_deep_research"

[tool.setuptools.package-data]
"*" = ["py.typed"]

[tool.ruff]
lint.select = [
    "E",    # pycodestyle
    "F",    # pyflakes
    "I",    # isort
    "D",    # pydocstyle
    "D401", # First line should be in imperative mood
    "T201",
    "UP",
]
lint.ignore = [
    "UP006",
    "UP007",
    "UP035",
    "D417",
    "E501",
]

[tool.ruff.lint.per-file-ignores]
"tests/*" = ["D", "UP"]

[tool.ruff.lint.pydocstyle]
convention = "google"

```
src/open_deep_research/__init__.py
```.py
"""Planning, research, and report generation."""

__version__ = "0.0.4"
```
src/open_deep_research/configuration.py
```.py
import os
from enum import Enum
from dataclasses import dataclass, fields
from typing import Any, Optional

from langchain_core.runnables import RunnableConfig
from dataclasses import dataclass

DEFAULT_REPORT_STRUCTURE = """Use this structure to create a report on the user-provided topic:

1. Introduction (no research needed)
   - Brief overview of the topic area

2. Main Body Sections:
   - Each section should focus on a sub-topic of the user-provided topic
   
3. Conclusion
   - Aim for 1 structural element (either a list of table) that distills the main body sections 
   - Provide a concise summary of the report"""

class SearchAPI(Enum):
    PERPLEXITY = "perplexity"
    TAVILY = "tavily"

class PlannerProvider(Enum):
    OPENAI = "openai"
    GROQ = "groq"

class WriterProvider(Enum):
    ANTHROPIC = "anthropic"

@dataclass(kw_only=True)
class Configuration:
    """The configurable fields for the chatbot."""
    report_structure: str = DEFAULT_REPORT_STRUCTURE # Defaults to the default report structure
    number_of_queries: int = 2 # Number of search queries to generate per iteration
    max_search_depth: int = 2 # Maximum number of reflection + search iterations
    planner_provider: PlannerProvider = PlannerProvider.OPENAI  # Defaults to OpenAI as provider
    planner_model: str = "o3-mini" # Defaults to OpenAI o3-mini as planner model
    writer_provider: WriterProvider = WriterProvider.ANTHROPIC # Defaults to Anthropic as provider
    writer_model: str = "claude-3-5-sonnet-latest" # Defaults to Anthropic as provider
    search_api: SearchAPI = SearchAPI.TAVILY # Default to TAVILY

    @classmethod
    def from_runnable_config(
        cls, config: Optional[RunnableConfig] = None
    ) -> "Configuration":
        """Create a Configuration instance from a RunnableConfig."""
        configurable = (
            config["configurable"] if config and "configurable" in config else {}
        )
        values: dict[str, Any] = {
            f.name: os.environ.get(f.name.upper(), configurable.get(f.name))
            for f in fields(cls)
            if f.init
        }
        return cls(**{k: v for k, v in values.items() if v})
```
src/open_deep_research/graph.py
```.py
from typing import Literal

from langchain_core.messages import HumanMessage, SystemMessage
from langchain.chat_models import init_chat_model
from langchain_core.runnables import RunnableConfig

from langgraph.constants import Send
from langgraph.graph import START, END, StateGraph
from langgraph.types import interrupt, Command

from open_deep_research.state import ReportStateInput, ReportStateOutput, Sections, ReportState, SectionState, SectionOutputState, Queries, Feedback
from open_deep_research.prompts import report_planner_query_writer_instructions, report_planner_instructions, query_writer_instructions, section_writer_instructions, final_section_writer_instructions, section_grader_instructions
from open_deep_research.configuration import Configuration
from open_deep_research.utils import tavily_search_async, deduplicate_and_format_sources, format_sections, perplexity_search

# Set writer model
writer_model = init_chat_model(model=Configuration.writer_model, model_provider=Configuration.writer_provider.value, temperature=0) 

# Nodes
async def generate_report_plan(state: ReportState, config: RunnableConfig):
    """ Generate the report plan """

    # Inputs
    topic = state["topic"]
    feedback = state.get("feedback_on_report_plan", None)

    # Get configuration
    configurable = Configuration.from_runnable_config(config)
    report_structure = configurable.report_structure
    number_of_queries = configurable.number_of_queries

    # Convert JSON object to string if necessary
    if isinstance(report_structure, dict):
        report_structure = str(report_structure)

    # Generate search query
    structured_llm = writer_model.with_structured_output(Queries)

    # Format system instructions
    system_instructions_query = report_planner_query_writer_instructions.format(topic=topic, report_organization=report_structure, number_of_queries=number_of_queries)

    # Generate queries  
    results = structured_llm.invoke([SystemMessage(content=system_instructions_query)]+[HumanMessage(content="Generate search queries that will help with planning the sections of the report.")])

    # Web search
    query_list = [query.search_query for query in results.queries]

    # Handle both cases for search_api:
    # 1. When selected in Studio UI -> returns a string (e.g. "tavily")
    # 2. When using default -> returns an Enum (e.g. SearchAPI.TAVILY)
    if isinstance(configurable.search_api, str):
        search_api = configurable.search_api
    else:
        search_api = configurable.search_api.value

    # Search the web
    if search_api == "tavily":
        search_results = await tavily_search_async(query_list)
        source_str = deduplicate_and_format_sources(search_results, max_tokens_per_source=1000, include_raw_content=False)
    elif search_api == "perplexity":
        search_results = perplexity_search(query_list)
        source_str = deduplicate_and_format_sources(search_results, max_tokens_per_source=1000, include_raw_content=False)
    else:
        raise ValueError(f"Unsupported search API: {configurable.search_api}")

    # Format system instructions
    system_instructions_sections = report_planner_instructions.format(topic=topic, report_organization=report_structure, context=source_str, feedback=feedback)

    # Set the planner provider
    if isinstance(configurable.planner_provider, str):
        planner_provider = configurable.planner_provider
    else:
        planner_provider = configurable.planner_provider.value

    # Set the planner model
    planner_llm = init_chat_model(model=Configuration.planner_model, model_provider=planner_provider, temperature=0)
    
    # Generate sections 
    structured_llm = planner_llm.with_structured_output(Sections)
    report_sections = structured_llm.invoke([SystemMessage(content=system_instructions_sections)]+[HumanMessage(content="Generate the sections of the report. Your response must include a 'sections' field containing a list of sections. Each section must have: name, description, plan, research, and content fields.")])

    # Get sections
    sections = report_sections.sections

    return {"sections": sections}

def human_feedback(state: ReportState, config: RunnableConfig) -> Command[Literal["generate_report_plan","build_section_with_web_research"]]:
    """ Get feedback on the report plan """

    # Get sections
    sections = state['sections']
    sections_str = "\n\n".join(
        f"Section: {section.name}\n"
        f"Description: {section.description}\n"
        f"Research needed: {'Yes' if section.research else 'No'}\n"
        for section in sections
    )

    # Get feedback on the report plan from interrupt

    feedback = interrupt(f"Please provide feedback on the following report plan. \n\n{sections_str}\n\n Does the report plan meet your needs? Pass 'true' to approve the report plan or provide feedback to regenerate the report plan:")

    # If the user approves the report plan, kick off section writing
    # if isinstance(feedback, bool) and feedback is True:
    if isinstance(feedback, bool):
        # Treat this as approve and kick off section writing
        return Command(goto=[
            Send("build_section_with_web_research", {"section": s, "search_iterations": 0}) 
            for s in sections 
            if s.research
        ])
    
    # If the user provides feedback, regenerate the report plan 
    elif isinstance(feedback, str):
        # treat this as feedback
        return Command(goto="generate_report_plan", 
                       update={"feedback_on_report_plan": feedback})
    else:
        raise TypeError(f"Interrupt value of type {type(feedback)} is not supported.")
    
def generate_queries(state: SectionState, config: RunnableConfig):
    """ Generate search queries for a report section """

    # Get state 
    section = state["section"]

    # Get configuration
    configurable = Configuration.from_runnable_config(config)
    number_of_queries = configurable.number_of_queries

    # Generate queries 
    structured_llm = writer_model.with_structured_output(Queries)

    # Format system instructions
    system_instructions = query_writer_instructions.format(section_topic=section.description, number_of_queries=number_of_queries)

    # Generate queries  
    queries = structured_llm.invoke([SystemMessage(content=system_instructions)]+[HumanMessage(content="Generate search queries on the provided topic.")])

    return {"search_queries": queries.queries}

async def search_web(state: SectionState, config: RunnableConfig):
    """ Search the web for each query, then return a list of raw sources and a formatted string of sources."""
    
    # Get state 
    search_queries = state["search_queries"]

    # Get configuration
    configurable = Configuration.from_runnable_config(config)

    # Web search
    query_list = [query.search_query for query in search_queries]
    
    # Handle both cases for search_api:
    # 1. When selected in Studio UI -> returns a string (e.g. "tavily")
    # 2. When using default -> returns an Enum (e.g. SearchAPI.TAVILY)
    if isinstance(configurable.search_api, str):
        search_api = configurable.search_api
    else:
        search_api = configurable.search_api.value

    # Search the web
    if search_api == "tavily":
        search_results = await tavily_search_async(query_list)
        source_str = deduplicate_and_format_sources(search_results, max_tokens_per_source=5000, include_raw_content=True)
    elif search_api == "perplexity":
        search_results = perplexity_search(query_list)
        source_str = deduplicate_and_format_sources(search_results, max_tokens_per_source=5000, include_raw_content=False)
    else:
        raise ValueError(f"Unsupported search API: {configurable.search_api}")

    return {"source_str": source_str, "search_iterations": state["search_iterations"] + 1}

def write_section(state: SectionState, config: RunnableConfig) -> Command[Literal[END,"search_web"]]:
    """ Write a section of the report """

    # Get state 
    section = state["section"]
    source_str = state["source_str"]

    # Get configuration
    configurable = Configuration.from_runnable_config(config)

    # Format system instructions
    system_instructions = section_writer_instructions.format(section_title=section.name, section_topic=section.description, context=source_str, section_content=section.content)

    # Generate section  
    section_content = writer_model.invoke([SystemMessage(content=system_instructions)]+[HumanMessage(content="Generate a report section based on the provided sources.")])
    
    # Write content to the section object  
    section.content = section_content.content

    # Grade prompt 
    section_grader_instructions_formatted = section_grader_instructions.format(section_topic=section.description,section=section.content)

    # Feedback 
    structured_llm = writer_model.with_structured_output(Feedback)
    feedback = structured_llm.invoke([SystemMessage(content=section_grader_instructions_formatted)]+[HumanMessage(content="Grade the report and consider follow-up questions for missing information:")])

    if feedback.grade == "pass" or state["search_iterations"] >= configurable.max_search_depth:
        # Publish the section to completed sections 
        return  Command(
        update={"completed_sections": [section]},
        goto=END
    )
    else:
        # Update the existing section with new content and update search queries
        return  Command(
        update={"search_queries": feedback.follow_up_queries, "section": section},
        goto="search_web"
        )
    
def write_final_sections(state: SectionState):
    """ Write final sections of the report, which do not require web search and use the completed sections as context """

    # Get state 
    section = state["section"]
    completed_report_sections = state["report_sections_from_research"]
    
    # Format system instructions
    system_instructions = final_section_writer_instructions.format(section_title=section.name, section_topic=section.description, context=completed_report_sections)

    # Generate section  
    section_content = writer_model.invoke([SystemMessage(content=system_instructions)]+[HumanMessage(content="Generate a report section based on the provided sources.")])
    
    # Write content to section 
    section.content = section_content.content

    # Write the updated section to completed sections
    return {"completed_sections": [section]}

def gather_completed_sections(state: ReportState):
    """ Gather completed sections from research and format them as context for writing the final sections """    

    # List of completed sections
    completed_sections = state["completed_sections"]

    # Format completed section to str to use as context for final sections
    completed_report_sections = format_sections(completed_sections)

    return {"report_sections_from_research": completed_report_sections}

def initiate_final_section_writing(state: ReportState):
    """ Write any final sections using the Send API to parallelize the process """    

    # Kick off section writing in parallel via Send() API for any sections that do not require research
    return [
        Send("write_final_sections", {"section": s, "report_sections_from_research": state["report_sections_from_research"]}) 
        for s in state["sections"] 
        if not s.research
    ]

def compile_final_report(state: ReportState):
    """ Compile the final report """    

    # Get sections
    sections = state["sections"]
    completed_sections = {s.name: s.content for s in state["completed_sections"]}

    # Update sections with completed content while maintaining original order
    for section in sections:
        section.content = completed_sections[section.name]

    # Compile final report
    all_sections = "\n\n".join([s.content for s in sections])

    return {"final_report": all_sections}

# Report section sub-graph -- 

# Add nodes 
section_builder = StateGraph(SectionState, output=SectionOutputState)
section_builder.add_node("generate_queries", generate_queries)
section_builder.add_node("search_web", search_web)
section_builder.add_node("write_section", write_section)

# Add edges
section_builder.add_edge(START, "generate_queries")
section_builder.add_edge("generate_queries", "search_web")
section_builder.add_edge("search_web", "write_section")

# Outer graph -- 

# Add nodes
builder = StateGraph(ReportState, input=ReportStateInput, output=ReportStateOutput, config_schema=Configuration)
builder.add_node("generate_report_plan", generate_report_plan)
builder.add_node("human_feedback", human_feedback)
builder.add_node("build_section_with_web_research", section_builder.compile())
builder.add_node("gather_completed_sections", gather_completed_sections)
builder.add_node("write_final_sections", write_final_sections)
builder.add_node("compile_final_report", compile_final_report)

# Add edges
builder.add_edge(START, "generate_report_plan")
builder.add_edge("generate_report_plan", "human_feedback")
builder.add_edge("build_section_with_web_research", "gather_completed_sections")
builder.add_conditional_edges("gather_completed_sections", initiate_final_section_writing, ["write_final_sections"])
builder.add_edge("write_final_sections", "compile_final_report")
builder.add_edge("compile_final_report", END)

graph = builder.compile()
```
src/open_deep_research/prompts.py
```.py
# Prompt to generate search queries to help with planning the report
report_planner_query_writer_instructions="""You are an expert technical writer, helping to plan a report. 

<Report topic>
{topic}
</Report topic>

<Report organization>
{report_organization}
</Report organization>

<Task>
Your goal is to generate {number_of_queries} search queries that will help gather comprehensive information for planning the report sections. 

The queries should:

1. Be related to the topic of the report
2. Help satisfy the requirements specified in the report organization

Make the queries specific enough to find high-quality, relevant sources while covering the breadth needed for the report structure.
</Task>"""

# Prompt to generate the report plan
report_planner_instructions="""I want a plan for a report. 

<Task>
Generate a list of sections for the report.

Each section should have the fields:

- Name - Name for this section of the report.
- Description - Brief overview of the main topics covered in this section.
- Research - Whether to perform web research for this section of the report.
- Content - The content of the section, which you will leave blank for now.

For example, introduction and conclusion will not require research because they will distill information from other parts of the report.
</Task>

<Topic>
The topic of the report is:
{topic}
</Topic>

<Report organization>
The report should follow this organization: 
{report_organization}
</Report organization>

<Context>
Here is context to use to plan the sections of the report: 
{context}
</Context>

<Feedback>
Here is feedback on the report structure from review (if any):
{feedback}
</Feedback>
"""

# Query writer instructions
query_writer_instructions="""You are an expert technical writer crafting targeted web search queries that will gather comprehensive information for writing a technical report section.

<Section topic>
{section_topic}
</Section topic>

<Task>
When generating {number_of_queries} search queries, ensure they:
1. Cover different aspects of the topic (e.g., core features, real-world applications, technical architecture)
2. Include specific technical terms related to the topic
3. Target recent information by including year markers where relevant (e.g., "2024")
4. Look for comparisons or differentiators from similar technologies/approaches
5. Search for both official documentation and practical implementation examples

Your queries should be:
- Specific enough to avoid generic results
- Technical enough to capture detailed implementation information
- Diverse enough to cover all aspects of the section plan
- Focused on authoritative sources (documentation, technical blogs, academic papers)
</Task>"""

# Section writer instructions
section_writer_instructions = """You are an expert technical writer crafting one section of a technical report.

<Section topic>
{section_topic}
</Section topic>

<Existing section content (if populated)>
{section_content}
</Existing section content>

<Source material>
{context}
</Source material>

<Guidelines for writing>
1. If the existing section content is not populated, write a new section from scratch.
2. If the existing section content is populated, write a new section that synthesizes the existing section content with the new information.
</Guidelines for writing>

<Length and style>
- Strict 150-200 word limit
- No marketing language
- Technical focus
- Write in simple, clear language
- Start with your most important insight in **bold**
- Use short paragraphs (2-3 sentences max)
- Use ## for section title (Markdown format)
- Only use ONE structural element IF it helps clarify your point:
  * Either a focused table comparing 2-3 key items (using Markdown table syntax)
  * Or a short list (3-5 items) using proper Markdown list syntax:
    - Use `*` or `-` for unordered lists
    - Use `1.` for ordered lists
    - Ensure proper indentation and spacing
- End with ### Sources that references the below source material formatted as:
  * List each source with title, date, and URL
  * Format: `- Title : URL`
</Length and style>

<Quality checks>
- Exactly 150-200 words (excluding title and sources)
- Careful use of only ONE structural element (table or list) and only if it helps clarify your point
- One specific example / case study
- Starts with bold insight
- No preamble prior to creating the section content
- Sources cited at end
</Quality checks>
"""

# Instructions for section grading
section_grader_instructions = """Review a report section relative to the specified topic:

<section topic>
{section_topic}
</section topic>

<section content>
{section}
</section content>

<task>
Evaluate whether the section adequately covers the topic by checking technical accuracy and depth.

If the section fails any criteria, generate specific follow-up search queries to gather missing information.
</task>

<format>
    grade: Literal["pass","fail"] = Field(
        description="Evaluation result indicating whether the response meets requirements ('pass') or needs revision ('fail')."
    )
    follow_up_queries: List[SearchQuery] = Field(
        description="List of follow-up search queries.",
    )
</format>
"""

final_section_writer_instructions="""You are an expert technical writer crafting a section that synthesizes information from the rest of the report.

<Section topic> 
{section_topic}
</Section topic>

<Available report content>
{context}
</Available report content>

<Task>
1. Section-Specific Approach:

For Introduction:
- Use # for report title (Markdown format)
- 50-100 word limit
- Write in simple and clear language
- Focus on the core motivation for the report in 1-2 paragraphs
- Use a clear narrative arc to introduce the report
- Include NO structural elements (no lists or tables)
- No sources section needed

For Conclusion/Summary:
- Use ## for section title (Markdown format)
- 100-150 word limit
- For comparative reports:
    * Must include a focused comparison table using Markdown table syntax
    * Table should distill insights from the report
    * Keep table entries clear and concise
- For non-comparative reports: 
    * Only use ONE structural element IF it helps distill the points made in the report:
    * Either a focused table comparing items present in the report (using Markdown table syntax)
    * Or a short list using proper Markdown list syntax:
      - Use `*` or `-` for unordered lists
      - Use `1.` for ordered lists
      - Ensure proper indentation and spacing
- End with specific next steps or implications
- No sources section needed

3. Writing Approach:
- Use concrete details over general statements
- Make every word count
- Focus on your single most important point
</Task>

<Quality Checks>
- For introduction: 50-100 word limit, # for report title, no structural elements, no sources section
- For conclusion: 100-150 word limit, ## for section title, only ONE structural element at most, no sources section
- Markdown format
- Do not include word count or any preamble in your response
</Quality Checks>"""
```
src/open_deep_research/state.py
```.py
from typing import Annotated, List, TypedDict, Literal
from pydantic import BaseModel, Field
import operator

class Section(BaseModel):
    name: str = Field(
        description="Name for this section of the report.",
    )
    description: str = Field(
        description="Brief overview of the main topics and concepts to be covered in this section.",
    )
    research: bool = Field(
        description="Whether to perform web research for this section of the report."
    )
    content: str = Field(
        description="The content of the section."
    )   

class Sections(BaseModel):
    sections: List[Section] = Field(
        description="Sections of the report.",
    )

class SearchQuery(BaseModel):
    search_query: str = Field(None, description="Query for web search.")

class Queries(BaseModel):
    queries: List[SearchQuery] = Field(
        description="List of search queries.",
    )

class Feedback(BaseModel):
    grade: Literal["pass","fail"] = Field(
        description="Evaluation result indicating whether the response meets requirements ('pass') or needs revision ('fail')."
    )
    follow_up_queries: List[SearchQuery] = Field(
        description="List of follow-up search queries.",
    )

class ReportStateInput(TypedDict):
    topic: str # Report topic
    
class ReportStateOutput(TypedDict):
    final_report: str # Final report

class ReportState(TypedDict):
    topic: str # Report topic    
    feedback_on_report_plan: str # Feedback on the report plan
    sections: list[Section] # List of report sections 
    completed_sections: Annotated[list, operator.add] # Send() API key
    report_sections_from_research: str # String of any completed sections from research to write final sections
    final_report: str # Final report

class SectionState(TypedDict):
    section: Section # Report section  
    search_iterations: int # Number of search iterations done
    search_queries: list[SearchQuery] # List of search queries
    source_str: str # String of formatted source content from web search
    report_sections_from_research: str # String of any completed sections from research to write final sections
    completed_sections: list[Section] # Final key we duplicate in outer state for Send() API

class SectionOutputState(TypedDict):
    completed_sections: list[Section] # Final key we duplicate in outer state for Send() API

```
src/open_deep_research/utils.py
```.py

import os
import asyncio
import requests

from tavily import TavilyClient, AsyncTavilyClient
from open_deep_research.state import Section
from langsmith import traceable

tavily_client = TavilyClient()
tavily_async_client = AsyncTavilyClient()

def deduplicate_and_format_sources(search_response, max_tokens_per_source, include_raw_content=True):
    """
    Takes a list of search responses and formats them into a readable string.
    Limits the raw_content to approximately max_tokens_per_source.
 
    Args:
        search_responses: List of search response dicts, each containing:
            - query: str
            - results: List of dicts with fields:
                - title: str
                - url: str
                - content: str
                - score: float
                - raw_content: str|None
        max_tokens_per_source: int
        include_raw_content: bool
            
    Returns:
        str: Formatted string with deduplicated sources
    """
     # Collect all results
    sources_list = []
    for response in search_response:
        sources_list.extend(response['results'])
    
    # Deduplicate by URL
    unique_sources = {source['url']: source for source in sources_list}

    # Format output
    formatted_text = "Sources:\n\n"
    for i, source in enumerate(unique_sources.values(), 1):
        formatted_text += f"Source {source['title']}:\n===\n"
        formatted_text += f"URL: {source['url']}\n===\n"
        formatted_text += f"Most relevant content from source: {source['content']}\n===\n"
        if include_raw_content:
            # Using rough estimate of 4 characters per token
            char_limit = max_tokens_per_source * 4
            # Handle None raw_content
            raw_content = source.get('raw_content', '')
            if raw_content is None:
                raw_content = ''
                print(f"Warning: No raw_content found for source {source['url']}")
            if len(raw_content) > char_limit:
                raw_content = raw_content[:char_limit] + "... [truncated]"
            formatted_text += f"Full source content limited to {max_tokens_per_source} tokens: {raw_content}\n\n"
                
    return formatted_text.strip()

def format_sections(sections: list[Section]) -> str:
    """ Format a list of sections into a string """
    formatted_str = ""
    for idx, section in enumerate(sections, 1):
        formatted_str += f"""
{'='*60}
Section {idx}: {section.name}
{'='*60}
Description:
{section.description}
Requires Research: 
{section.research}

Content:
{section.content if section.content else '[Not yet written]'}

"""
    return formatted_str

@traceable
async def tavily_search_async(search_queries):
    """
    Performs concurrent web searches using the Tavily API.

    Args:
        search_queries (List[SearchQuery]): List of search queries to process

    Returns:
            List[dict]: List of search responses from Tavily API, one per query. Each response has format:
                {
                    'query': str, # The original search query
                    'follow_up_questions': None,      
                    'answer': None,
                    'images': list,
                    'results': [                     # List of search results
                        {
                            'title': str,            # Title of the webpage
                            'url': str,              # URL of the result
                            'content': str,          # Summary/snippet of content
                            'score': float,          # Relevance score
                            'raw_content': str|None  # Full page content if available
                        },
                        ...
                    ]
                }
    """
    
    search_tasks = []
    for query in search_queries:
            search_tasks.append(
                tavily_async_client.search(
                    query,
                    max_results=5,
                    include_raw_content=True,
                    topic="general"
                )
            )

    # Execute all searches concurrently
    search_docs = await asyncio.gather(*search_tasks)

    return search_docs

@traceable
def perplexity_search(search_queries):
    """Search the web using the Perplexity API.
    
    Args:
        search_queries (List[SearchQuery]): List of search queries to process
  
    Returns:
        List[dict]: List of search responses from Perplexity API, one per query. Each response has format:
            {
                'query': str,                    # The original search query
                'follow_up_questions': None,      
                'answer': None,
                'images': list,
                'results': [                     # List of search results
                    {
                        'title': str,            # Title of the search result
                        'url': str,              # URL of the result
                        'content': str,          # Summary/snippet of content
                        'score': float,          # Relevance score
                        'raw_content': str|None  # Full content or None for secondary citations
                    },
                    ...
                ]
            }
    """

    headers = {
        "accept": "application/json",
        "content-type": "application/json",
        "Authorization": f"Bearer {os.getenv('PERPLEXITY_API_KEY')}"
    }
    
    search_docs = []
    for query in search_queries:

        payload = {
            "model": "sonar-pro",
            "messages": [
                {
                    "role": "system",
                    "content": "Search the web and provide factual information with sources."
                },
                {
                    "role": "user",
                    "content": query
                }
            ]
        }
        
        response = requests.post(
            "https://api.perplexity.ai/chat/completions",
            headers=headers,
            json=payload
        )
        response.raise_for_status()  # Raise exception for bad status codes
        
        # Parse the response
        data = response.json()
        content = data["choices"][0]["message"]["content"]
        citations = data.get("citations", ["https://perplexity.ai"])
        
        # Create results list for this query
        results = []
        
        # First citation gets the full content
        results.append({
            "title": f"Perplexity Search, Source 1",
            "url": citations[0],
            "content": content,
            "raw_content": content,
            "score": 1.0  # Adding score to match Tavily format
        })
        
        # Add additional citations without duplicating content
        for i, citation in enumerate(citations[1:], start=2):
            results.append({
                "title": f"Perplexity Search, Source {i}",
                "url": citation,
                "content": "See primary source for full content",
                "raw_content": None,
                "score": 0.5  # Lower score for secondary sources
            })
        
        # Format response to match Tavily structure
        search_docs.append({
            "query": query,
            "follow_up_questions": None,
            "answer": None,
            "images": [],
            "results": results
        })
    
    return search_docs

```

