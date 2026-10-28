
const http = require('http');
const url = require('url');
const fs = require('fs');
const path = require('path');
const pool = require('./db');

const PORT = 3000;

const server = http.createServer(async (req, res) => {
  const { pathname } = url.parse(req.url, true);

  // Identifica o ID em rotas como /api/alunos/5
  const partes = pathname.split('/');
  const idAluno =
    partes.length === 4 &&
      partes[1] === 'api' &&
      partes[2] === 'alunos' &&
      /^\d+$/.test(partes[3]) &&
      Number(partes[3]) > 0
      ? Number(partes[3])
      : null;

  // GET / - entrega o frontend
  if (req.method === 'GET' && pathname === '/') {
    fs.readFile(
      path.join(__dirname, 'public', 'index.html'),
      (err, conteudo) => {
        if (err) {
          return enviarJSON(res, 500, {
            erro: 'Erro ao carregar index.html'
          });
        }

        res.writeHead(200, {
          'Content-Type': 'text/html; charset=utf-8'
        });

        res.end(conteudo);
      }
    );

    // GET /api/alunos - consulta os alunos
  } else if (
    req.method === 'GET' &&
    pathname === '/api/alunos'
  ) {
    try {
      const [rows] = await pool.query(`
                SELECT
                    a.id_aluno,
                    a.matricula,
                    a.nome,
                    a.cpf,
                    a.celular,
                    a.idCurso,
                    c.nome AS curso
                FROM aluno a
                INNER JOIN curso c
                    ON a.idCurso = c.idCurso
                ORDER BY a.id_aluno
            `);

      enviarJSON(res, 200, rows);

    } catch (err) {
      console.error(err);

      enviarJSON(res, 500, {
        erro: 'Erro ao buscar alunos.'
      });
    }

    // POST /api/alunos - cadastra um aluno
  } else if (
    req.method === 'POST' &&
    pathname === '/api/alunos'
  ) {
    try {
      const aluno = await lerCorpo(req);

      const [resultado] = await pool.query(
        `INSERT INTO aluno
                    (matricula, nome, cpf, celular, idCurso)
                 VALUES (?, ?, ?, ?, ?)`,
        [
          aluno.matricula,
          aluno.nome,
          aluno.cpf,
          aluno.celular,
          aluno.idCurso
        ]
      );

      enviarJSON(res, 201, {
        id_aluno: resultado.insertId,
        mensagem: 'Aluno cadastrado com sucesso!'
      });

    } catch (err) {
      console.error(err);

      enviarJSON(res, 500, {
        erro: 'Erro ao cadastrar aluno: ' + err.message
      });
    }

    // PUT /api/alunos/5 - atualiza o aluno de ID 5
  } else if (
    req.method === 'PUT' &&
    idAluno !== null
  ) {
    try {
      const aluno = await lerCorpo(req);

      const [resultado] = await pool.query(
        `UPDATE aluno
                 SET matricula = ?,
                     nome = ?,
                     cpf = ?,
                     celular = ?,
                     idCurso = ?
                 WHERE id_aluno = ?`,
        [
          aluno.matricula,
          aluno.nome,
          aluno.cpf,
          aluno.celular,
          aluno.idCurso,
          idAluno
        ]
      );

      if (resultado.affectedRows === 0) {
        return enviarJSON(res, 404, {
          erro: 'Aluno não encontrado.'
        });
      }

      enviarJSON(res, 200, {
        mensagem: 'Aluno atualizado com sucesso!'
      });

    } catch (err) {
      console.error(err);

      enviarJSON(res, 500, {
        erro: 'Erro ao atualizar aluno: ' + err.message
      });
    }

    // Qualquer rota não reconhecida
  } else {
    enviarJSON(res, 404, {
      erro: 'Página ou rota não encontrada.'
    });
  }
});

function enviarJSON(res, status, dados) {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8'
  });

  res.end(JSON.stringify(dados));
}

function lerCorpo(req) {
  return new Promise((resolve, reject) => {
    let corpo = '';

    req.on('data', parte => {
      corpo += parte;
    });

    req.on('end', () => {
      try {
        resolve(JSON.parse(corpo));
      } catch (err) {
        reject(new Error('JSON inválido no corpo da requisição.'));
      }
    });

    req.on('error', reject);
  });
}
server.listen(PORT, () => {
  console.log(`Servidor rodando em http://localhost:${PORT}/`);
});
