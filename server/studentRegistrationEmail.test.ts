import test from 'node:test';
import assert from 'node:assert/strict';
import {studentRegistrationEmailAllowed} from '../src/utils/studentRegistrationEmail';
test('registration accepts valid personal and institutional addresses without domain exceptions',()=>{
 for(const email of ['aluno@edu.ufes.br','laripandolfi@gmail.com','outro@gmail.com','outro+teste@gmail.com','aluno@outlook.com','aluno@yahoo.com.br','pessoa@outra-instituicao.org',' PESSOA@EXAMPLE.COM '])assert.equal(studentRegistrationEmailAllowed(email),true,email);
 for(const email of ['', 'sem-email', 'nome@', '@gmail.com','nome@@gmail.com','nome @gmail.com','nome@gmail','nome\n@example.com','a'.repeat(250)+'@example.com'])assert.equal(studentRegistrationEmailAllowed(email),false,email);
});
