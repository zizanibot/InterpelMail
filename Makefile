PYTHON=python
BASE_FOLDER=scripts
ifeq ($(OS),Windows_NT)
  VENV=$(BASE_FOLDER)\.venv
  BIN=$(VENV)\Scripts
  PIP=$(BIN)\pip
  PYTEST=$(BIN)\pytest
  MYPY=$(BIN)\mypy
  VENV_PYTHON = $(BIN)\$(PYTHON)
  REQ = $(BASE_FOLDER)\requirements.txt
  MAIN = $(BASE_FOLDER)\main.py
else
  VENV=$(BASE_FOLDER)/venv
  BIN=$(VENV)/bin
  PIP=$(BIN)/pip
  PYTEST=$(BIN)/pytest
  MYPY=$(BIN)/mypy
  VENV_PYTHON = $(BIN)/$(PYTHON)
  REQ = $(BASE_FOLDER)/requirements.txt
  MAIN = $(BASE_FOLDER)/main.py
endif

# install
install_venv:
	$(PYTHON) -m venv --clear $(VENV)
	$(VENV_PYTHON) -m pip install --upgrade pip

install: install_venv
	$(PIP) install --upgrade -r $(REQ)

# run
run:
	$(VENV_PYTHON) $(MAIN)

# unit testing
test:
	$(PYTEST) -v

# type annotations
mypy:
	$(MYPY) $(BASE_FOLDER) --strict

# unit testing + type checking
check: test mypy