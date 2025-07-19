const express = require('express');
const cors = require('cors');
const { createClient } = require('supabase-js');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

app.get('/api/data', async (req, res) => {
  const { data, error } = await supabase.from('items').select('*');
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

const port = process.env.PORT || 3001;
app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});
