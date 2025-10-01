from recbole.quick_start import load_data_and_model


class RecBoleEnvironment:
    def __init__(self):
        self.config = None
        self.model = None
        self.dataset = None
        self.train_data = None
        self.valid_data = None
        self.test_data = None
        self.is_initialized = False

    def initialize(self, model_path):
        """Initialize the RecBole environment"""
        self.config, self.model, self.dataset, self.train_data, self.valid_data, self.test_data = load_data_and_model(
            model_file=model_path
        )
        self.is_initialized = True
        print("RecBole environment initialized successfully")

    def get_environment(self):
        """Get the environment or raise error if not initialized"""
        if not self.is_initialized:
            raise RuntimeError("RecBole environment not initialized. Call initialize() first.")
        return self.config, self.model, self.dataset, self.train_data, self.valid_data, self.test_data


recbole_env = RecBoleEnvironment()
